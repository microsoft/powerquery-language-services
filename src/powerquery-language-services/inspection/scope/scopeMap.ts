// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// This module owns generic scope storage and does not interpret parser nodes or scope-item kinds.
// scopeBindings.ts decides which names should be visible; these maps store and combine those names
// without repeatedly copying inherited or sibling entries.

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
