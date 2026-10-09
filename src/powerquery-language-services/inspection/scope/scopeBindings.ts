// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { IdentifierUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { BindingScopeMap } from "./scopeMap";
import { TKeyValuePairScopeItem } from "./scope";

interface Binding<KVP, T> {
    readonly pair: KVP;
    readonly keys: ReadonlyArray<string>;
    readonly nonRecursive: T;
    recursive: T | undefined;
}

// One table per let/record/section, shared by all of its value scopes.
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
        if (binding.recursive === undefined) {
            binding.recursive = this.factory(binding.pair, true);
        }

        return binding.recursive;
    }
}
