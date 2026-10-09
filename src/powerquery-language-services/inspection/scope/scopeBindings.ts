// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { IdentifierUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { BindingScopeMap } from "./scopeMap";
import { TKeyValuePairScopeItem } from "./scope";

// This module owns Power Query binding rules: which sibling names are visible and when a
// self-reference is recursive. scopeMap.ts only provides the generic shared-map storage used to
// represent those decisions without copying entries.

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
// ScopeBindings builds that common table once. forSelf then returns either the shared table or a
// small view containing only the differences for the current binding. For example, while inspecting
// `a` in `let a = @a, b = a in b`, ordinary `a` is hidden but recursive `@a` points back to `a`.
//
// Duplicate aliases are the exception. Removing one duplicate can change Map insertion order, so
// those uncommon cases are rebuilt to preserve the behavior of the original materialized maps.
export class ScopeBindings<KVP extends NodeIdMapIterator.TKeyValuePair, T extends TKeyValuePairScopeItem> {
    private readonly base: Map<string, T> = new Map();
    private readonly bindings: Binding<KVP, T>[] = [];
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

            this.bindings.push(binding);
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

    public forSelf(keyNodeId: number): ReadonlyMap<string, T> {
        // Excluding a duplicate's first occurrence can change insertion order, not just its value.
        if (this.hasDuplicateKeys) {
            const result: Map<string, T> = new Map();

            for (const binding of this.bindings) {
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
