// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { IdentifierUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { TKeyValuePairScopeItem } from "./scope";

// This module defines sibling visibility and recursive self-reference rules, plus the shared-map
// views that represent those bindings and combine them with inherited scopes without copying entries.

// This stores the work shared by every scope derived from one key/value pair. `keys` contains all
// valid spellings of the name, and `nonRecursive` is reused by sibling scopes. The recursive form
// starts empty because only the binding's own value can need it.
interface Binding<KVP, T> {
    readonly pair: KVP;
    readonly keys: ReadonlyArray<string>;
    readonly nonRecursive: T;
    recursive: T | undefined;
}

// A let, record, or section gives each value access to almost the same set of sibling names.
// Building a complete Map for every value repeats nearly all of the same entries and descriptors.
//
// ScopeBindings builds that common table once and exposes it through all. forSelf returns a
// small view containing only the differences for the current binding. For example, while inspecting
// `a` in `let a = @a, b = a in b`, ordinary `a` is hidden but recursive `@a` points back to `a`.
//
// Duplicate aliases are the exception. Removing one duplicate can change Map insertion order, so
// those uncommon cases are rebuilt to preserve the behavior of the original materialized maps.
export class ScopeBindings<KVP extends NodeIdMapIterator.TKeyValuePair, T extends TKeyValuePairScopeItem> {
    private readonly base: Map<string, T> = new Map();
    private readonly bindingByKeyId: Map<number, Binding<KVP, T>> = new Map();
    private readonly factory: (pair: KVP, recursive: boolean) => T;
    private readonly cancellationToken: ICancellationToken | undefined;
    private hasDuplicateKeys: boolean = false;

    constructor(
        pairs: ReadonlyArray<KVP>,
        options: IdentifierUtils.GetAllowedIdentifiersOptions,
        factory: (pair: KVP, recursive: boolean) => T,
        cancellationToken: ICancellationToken | undefined,
    ) {
        this.factory = factory;
        this.cancellationToken = cancellationToken;

        for (const pair of pairs) {
            cancellationToken?.throwIfCancelled();

            if (pair.value === undefined) {
                continue;
            }

            const binding: Binding<KVP, T> = {
                pair,
                keys: IdentifierUtils.getAllowedIdentifiers(pair.key.literal, options),
                nonRecursive: factory(pair, false),
                recursive: undefined,
            };

            this.bindingByKeyId.set(pair.key.id, binding);

            for (const key of binding.keys) {
                const previous: T | undefined = this.base.get(key);

                if (previous !== undefined && previous.nodeId !== binding.nonRecursive.nodeId) {
                    this.hasDuplicateKeys = true;
                }

                this.base.set(key, binding.nonRecursive);
            }
        }
    }

    public get all(): ReadonlyMap<string, T> {
        return this.base;
    }

    public forSelf(keyNodeId: number): ReadonlyMap<string, T> {
        // Excluding a duplicate's first occurrence can change insertion order, not just its value.
        if (this.hasDuplicateKeys) {
            const result: Map<string, T> = new Map();

            for (const binding of this.bindingByKeyId.values()) {
                this.cancellationToken?.throwIfCancelled();
                const isRecursive: boolean = keyNodeId === binding.pair.key.id;

                for (const key of binding.keys) {
                    if (!isRecursive || key.includes("@")) {
                        result.set(key, isRecursive ? this.recursiveItem(binding) : binding.nonRecursive);
                    }
                }
            }

            return result;
        }

        const binding: Binding<KVP, T> | undefined = this.bindingByKeyId.get(keyNodeId);

        if (binding === undefined) {
            return this.base;
        }

        const hidden: Set<string> = new Set();
        const recursive: Map<string, T> = new Map();

        // Ordinary self-references are hidden, while @ aliases must resolve recursively.
        for (const key of binding.keys) {
            if (key.includes("@")) {
                recursive.set(key, this.recursiveItem(binding));
            } else {
                hidden.add(key);
            }
        }

        return new BindingScopeMap(this.base, hidden, recursive);
    }

    private recursiveItem(binding: Binding<KVP, T>): T {
        // Create one recursive descriptor only for bindings that reference themselves.
        if (binding.recursive === undefined) {
            binding.recursive = this.factory(binding.pair, true);
        }

        return binding.recursive;
    }
}

// These scope views are returned as ReadonlyMap values but are not native Map instances. The
// backing maps never change after publication, which makes it safe for multiple scopes to share
// them. This base class keeps the standard iteration methods consistent between the two views below.
abstract class ReadonlyScopeMap<T extends object> implements ReadonlyMap<string, T> {
    public readonly [Symbol.toStringTag]: string = "Map";

    public abstract get size(): number;
    public abstract get(key: string): T | undefined;
    public abstract has(key: string): boolean;
    public abstract entries(): MapIterator<[string, T]>;

    public *keys(): MapIterator<string> {
        for (const [key] of this.entries()) {
            yield key;
        }
    }

    public *values(): MapIterator<T> {
        for (const [, value] of this.entries()) {
            yield value;
        }
    }

    public [Symbol.iterator](): MapIterator<[string, T]> {
        return this.entries();
    }

    public forEach(callbackfn: (value: T, key: string, map: ReadonlyMap<string, T>) => void, thisArg?: unknown): void {
        for (const [key, value] of this.entries()) {
            callbackfn.call(thisArg, value, key, this);
        }
    }
}

// This is the small, binding-specific view produced by ScopeBindings.
//
// `base` contains all sibling names. `hidden` removes the current binding's ordinary aliases so
// an outer binding with the same name can still be found. `recursive` replaces only the current
// binding's @ aliases with descriptors marked as recursive.
//
// Keeping these differences separate is much cheaper than copying the full sibling Map for every
// value in a large let, record, or section.
export class BindingScopeMap<T extends object> extends ReadonlyScopeMap<T> {
    private readonly base: ReadonlyMap<string, T>;
    private readonly hidden: ReadonlySet<string>;
    private readonly recursive: ReadonlyMap<string, T>;
    private readonly hiddenCount: number;

    constructor(base: ReadonlyMap<string, T>, hidden: ReadonlySet<string>, recursive: ReadonlyMap<string, T>) {
        super();
        this.base = base;
        this.hidden = hidden;
        this.recursive = recursive;
        this.hiddenCount = [...hidden].filter((key: string) => base.has(key)).length;
    }

    public get size(): number {
        return this.base.size - this.hiddenCount;
    }

    public get(key: string): T | undefined {
        return this.hidden.has(key) ? undefined : (this.recursive.get(key) ?? this.base.get(key));
    }

    public has(key: string): boolean {
        return !this.hidden.has(key) && this.base.has(key);
    }

    public *entries(): MapIterator<[string, T]> {
        for (const [key, value] of this.base) {
            if (!this.hidden.has(key)) {
                yield [key, this.recursive.get(key) ?? value];
            }
        }
    }
}

// Most syntax nodes inherit a large parent scope and add only a few local names. Copying the parent
// Map at every node causes the same entries to be stored thousands of times.
//
// MergedScopeMap keeps the parent and local Map as separate layers. A lookup checks local names
// first and then walks outward through parent layers. Full materialization happens only when a
// caller enumerates the complete scope, where native Map shadowing and insertion order must be
// reproduced exactly.
class MergedScopeMap<T extends object> extends ReadonlyScopeMap<T> {
    private readonly parent: ReadonlyMap<string, T>;
    private readonly own: ReadonlyMap<string, T>;
    private cachedSize: number | undefined;

    constructor(parent: ReadonlyMap<string, T>, own: ReadonlyMap<string, T>) {
        super();
        this.parent = parent;
        this.own = own;
    }

    public get size(): number {
        if (this.cachedSize === undefined) {
            let size: number = this.parent.size;

            for (const key of this.own.keys()) {
                if (!this.parent.has(key)) {
                    size += 1;
                }
            }

            this.cachedSize = size;
        }

        return this.cachedSize;
    }

    public get(key: string): T | undefined {
        let scope: ReadonlyMap<string, T> = this;

        while (scope instanceof MergedScopeMap) {
            const value: T | undefined = scope.own.get(key);

            if (value !== undefined) {
                return value;
            }

            scope = scope.parent;
        }

        return scope.get(key);
    }

    public has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    public *entries(): MapIterator<[string, T]> {
        const layers: ReadonlyMap<string, T>[] = [];
        let scope: ReadonlyMap<string, T> = this;

        while (scope instanceof MergedScopeMap) {
            layers.push(scope.own);
            scope = scope.parent;
        }

        // Materialize only for enumeration, not for every scope created along the ancestry.
        const entries: Map<string, T> = new Map(scope);

        for (let index: number = layers.length - 1; index >= 0; index -= 1) {
            for (const [key, value] of layers[index]) {
                entries.set(key, value);
            }
        }

        yield* entries;
    }
}

export function mergeScopeMaps<T extends object>(
    parent: ReadonlyMap<string, T>,
    own: ReadonlyMap<string, T>,
): ReadonlyMap<string, T> {
    if (own.size === 0) {
        return parent;
    } else if (parent.size === 0) {
        return own;
    }

    return new MergedScopeMap(parent, own);
}
