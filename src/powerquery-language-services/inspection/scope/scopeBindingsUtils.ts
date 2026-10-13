// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { IdentifierUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { Binding, BindingScopeMap, MergedScopeMap, ScopeBindings, ScopeMapKind } from "./scopeBindings";
import { ScopeMap, TKeyValuePairScopeItem } from "./scope";

// Build sibling descriptors once; self views reuse them rather than copying the full table.
export function createScopeBindings<KVP extends NodeIdMapIterator.TKeyValuePair, T extends TKeyValuePairScopeItem>(
    pairs: ReadonlyArray<KVP>,
    options: IdentifierUtils.GetAllowedIdentifiersOptions,
    factory: (pair: KVP, recursive: boolean) => T,
    cancellationToken: ICancellationToken | undefined,
): ScopeBindings<KVP, T> {
    const all: Map<string, T> = new Map();
    const bindingByKeyId: Map<number, Binding<KVP, T>> = new Map();
    let hasDuplicateKeys: boolean = false;

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

        bindingByKeyId.set(pair.key.id, binding);

        for (const key of binding.keys) {
            const previous: T | undefined = all.get(key);

            if (previous !== undefined && previous.nodeId !== binding.nonRecursive.nodeId) {
                hasDuplicateKeys = true;
            }

            all.set(key, binding.nonRecursive);
        }
    }

    return { all, bindingByKeyId, hasDuplicateKeys, factory, cancellationToken };
}

export function scopeForSelf<KVP extends NodeIdMapIterator.TKeyValuePair, T extends TKeyValuePairScopeItem>(
    state: ScopeBindings<KVP, T>,
    keyNodeId: number,
): ScopeMap<T> {
    // Excluding a duplicate's first occurrence can change insertion order, not just its value.
    if (state.hasDuplicateKeys) {
        const result: Map<string, T> = new Map();

        for (const binding of state.bindingByKeyId.values()) {
            state.cancellationToken?.throwIfCancelled();
            const isRecursive: boolean = keyNodeId === binding.pair.key.id;

            for (const key of binding.keys) {
                if (!isRecursive || key.includes("@")) {
                    result.set(key, isRecursive ? recursiveItem(binding, state.factory) : binding.nonRecursive);
                }
            }
        }

        return result;
    }

    const binding: Binding<KVP, T> | undefined = state.bindingByKeyId.get(keyNodeId);

    if (binding === undefined) {
        return state.all;
    }

    const hidden: Set<string> = new Set();
    const recursive: Map<string, T> = new Map();

    // Ordinary self-references are hidden, while @ aliases must resolve recursively.
    for (const key of binding.keys) {
        if (key.includes("@")) {
            recursive.set(key, recursiveItem(binding, state.factory));
        } else {
            hidden.add(key);
        }
    }

    return createBindingScopeMap(state.all, hidden, recursive);
}

function recursiveItem<KVP, T>(binding: Binding<KVP, T>, factory: (pair: KVP, recursive: boolean) => T): T {
    if (binding.recursive === undefined) {
        binding.recursive = factory(binding.pair, true);
    }

    return binding.recursive;
}

export function createBindingScopeMap<T extends object>(
    base: ScopeMap<T>,
    hidden: ReadonlySet<string>,
    recursive: ReadonlyMap<string, T>,
): BindingScopeMap<T> {
    return {
        kind: ScopeMapKind.Binding,
        base,
        hidden,
        recursive,
        size: scopeMapSize(base) - [...hidden].filter((key: string) => scopeMapHas(base, key)).length,
    };
}

export function mergeScopeMaps<T extends object>(parent: ScopeMap<T>, own: ScopeMap<T>): ScopeMap<T> {
    if (scopeMapSize(own) === 0) {
        return parent;
    } else if (scopeMapSize(parent) === 0) {
        return own;
    }

    return { kind: ScopeMapKind.Merged, parent, own, cachedSize: undefined };
}

export function scopeMapSize<T extends object>(scope: ScopeMap<T>): number {
    if (!isMergedScopeMap(scope)) {
        return scope.size;
    }

    if (scope.cachedSize === undefined) {
        let size: number = scopeMapSize(scope.parent);

        for (const key of scopeMapKeys(scope.own)) {
            if (!scopeMapHas(scope.parent, key)) {
                size += 1;
            }
        }

        scope.cachedSize = size;
    }

    return scope.cachedSize;
}

export function scopeMapGet<T extends object>(scope: ScopeMap<T>, key: string): T | undefined {
    while (isMergedScopeMap(scope)) {
        const value: T | undefined = scopeMapGet(scope.own, key);

        if (value !== undefined) {
            return value;
        }

        scope = scope.parent;
    }

    if (isBindingScopeMap(scope)) {
        return scope.hidden.has(key) ? undefined : (scope.recursive.get(key) ?? scopeMapGet(scope.base, key));
    }

    return scope.get(key);
}

export function scopeMapHas<T extends object>(scope: ScopeMap<T>, key: string): boolean {
    if (isBindingScopeMap(scope)) {
        return !scope.hidden.has(key) && scopeMapHas(scope.base, key);
    } else if (isMergedScopeMap(scope)) {
        return scopeMapGet(scope, key) !== undefined;
    }

    return scope.has(key);
}

export function* scopeMapKeys<T extends object>(scope: ScopeMap<T>): MapIterator<string> {
    for (const [key] of scopeMapEntries(scope)) {
        yield key;
    }
}

export function* scopeMapEntries<T extends object>(scope: ScopeMap<T>): MapIterator<[string, T]> {
    if (isBindingScopeMap(scope)) {
        for (const [key, value] of scopeMapEntries(scope.base)) {
            if (!scope.hidden.has(key)) {
                yield [key, scope.recursive.get(key) ?? value];
            }
        }

        return;
    } else if (!isMergedScopeMap(scope)) {
        yield* scope.entries();

        return;
    }

    const layers: ScopeMap<T>[] = [];

    while (isMergedScopeMap(scope)) {
        layers.push(scope.own);
        scope = scope.parent;
    }

    // Materialize only for enumeration; walk parent layers iteratively to support deep scopes.
    const entries: Map<string, T> = new Map(scopeMapEntries(scope));

    for (let index: number = layers.length - 1; index >= 0; index -= 1) {
        for (const [key, value] of scopeMapEntries(layers[index])) {
            entries.set(key, value);
        }
    }

    yield* entries;
}

function isBindingScopeMap<T extends object>(scope: ScopeMap<T>): scope is BindingScopeMap<T> {
    return "kind" in scope && scope.kind === ScopeMapKind.Binding;
}

function isMergedScopeMap<T extends object>(scope: ScopeMap<T>): scope is MergedScopeMap<T> {
    return "kind" in scope && scope.kind === ScopeMapKind.Merged;
}
