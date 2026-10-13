// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { NodeIdMapIterator } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { ScopeMap, TKeyValuePairScopeItem } from "./scope";

// Shared descriptors and spellings for one binding; its recursive form is created on demand.
export interface Binding<KVP, T> {
    readonly pair: KVP;
    readonly keys: ReadonlyArray<string>;
    readonly nonRecursive: T;
    recursive: T | undefined;
}

export interface ScopeBindings<KVP extends NodeIdMapIterator.TKeyValuePair, T extends TKeyValuePairScopeItem> {
    readonly all: ReadonlyMap<string, T>;
    readonly bindingByKeyId: ReadonlyMap<number, Binding<KVP, T>>;
    readonly hasDuplicateKeys: boolean;
    readonly factory: (pair: KVP, recursive: boolean) => T;
    readonly cancellationToken: ICancellationToken | undefined;
}

export enum ScopeMapKind {
    Binding = "Binding",
    Merged = "Merged",
}

export interface BindingScopeMap<T extends object> {
    readonly kind: ScopeMapKind.Binding;
    readonly base: ScopeMap<T>;
    readonly hidden: ReadonlySet<string>;
    readonly recursive: ReadonlyMap<string, T>;
    readonly size: number;
}

export interface MergedScopeMap<T extends object> {
    readonly kind: ScopeMapKind.Merged;
    readonly parent: ScopeMap<T>;
    readonly own: ScopeMap<T>;
    cachedSize: number | undefined;
}
