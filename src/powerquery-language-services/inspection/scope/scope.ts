// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

// Keys are identifier literals.
// Base class provides empty/no-op behavior. Subclass LazyScopeTypeByKey adds deferred resolution.
export class ScopeTypeByKey {
    public static readonly empty: ScopeTypeByKey = Object.freeze(new ScopeTypeByKey());

    /** Whether the key exists in scope (regardless of type resolution status). */
    has(_key: string): boolean {
        return false;
    }

    /** All keys in scope. */
    keys(): IterableIterator<string> {
        return new Map<string, never>().keys();
    }

    /** Total number of scope items. */
    get size(): number {
        return 0;
    }

    /** Lazily resolve the type for a specific key. Returns undefined if key not in scope. Caches the result. */
    // eslint-disable-next-line require-await
    async resolveType(_key: string): Promise<Type.TPowerQueryType | undefined> {
        return undefined;
    }

    /** Eagerly resolve all scope item types. Returns a fully-populated read-only map. */
    // eslint-disable-next-line require-await
    async resolveAll(): Promise<ReadonlyMap<string, Type.TPowerQueryType>> {
        return new Map<string, Type.TPowerQueryType>();
    }

    /** Resolves all types, then returns an iterator of [key, type] pairs. */
    // eslint-disable-next-line require-await
    async entries(): Promise<IterableIterator<[string, Type.TPowerQueryType]>> {
        return new Map<string, Type.TPowerQueryType>().entries();
    }

    /** Resolves all types, then returns an iterator of types. */
    // eslint-disable-next-line require-await
    async values(): Promise<IterableIterator<Type.TPowerQueryType>> {
        return new Map<string, Type.TPowerQueryType>().values();
    }

    /** Resolves all types, then calls the callback for each entry. */
    async forEach(_callbackfn: (value: Type.TPowerQueryType, key: string) => void): Promise<void> {
        /* no-op for empty scope */
    }
}

export type TriedNodeScope = PQP.Result<NodeScope, PQP.CommonError.CommonError>;

// Scopes for multiple nodes, where the keys are nodeIds.
// Serves as a cache when building the scope for a specific node.
export type ScopeById = Map<number, NodeScope>;

// Scope that was generated for a specific nodeId.
// Has the potential to be reused for its child nodes.
export interface NodeScope {
    readonly createdForNodeId: number | undefined;
    // Mostly a tag for debugging.
    readonly scopeItemByKey: ReadonlyMap<string, TScopeItem>;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TScopeItem =
    | EachScopeItem
    | LetVariableScopeItem
    | ParameterScopeItem
    | RecordFieldScopeItem
    | SectionMemberScopeItem
    | UndefinedScopeItem;

export type TKeyValuePairScopeItem = LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem;

export enum ScopeItemKind {
    Each = "Each",
    LetVariable = "LetVariable",
    Parameter = "Parameter",
    RecordField = "RecordField",
    SectionMember = "SectionMember",
    Undefined = "Undefined",
}

export interface IScopeItem {
    readonly kind: ScopeItemKind;
    readonly nodeId: number;
    readonly isRecursive: boolean;
}

export interface IKeyValuePairScopeItem<
    Key extends Ast.Identifier | Ast.GeneralizedIdentifier,
    Kind extends ScopeItemKind.LetVariable | ScopeItemKind.RecordField | ScopeItemKind.SectionMember,
> extends IScopeItem {
    readonly kind: Kind;
    readonly key: Key;
    readonly value: TXorNode | undefined;
}

export interface EachScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Each;
    readonly eachExpression: TXorNode;
    // The typing used for the implicit parameter ('_').
    // Defers to eachScopeById when provided, otherwise Type.UnknownInstance.
    readonly implicitParameterType: Type.TPowerQueryType;
}

export type LetVariableScopeItem = IKeyValuePairScopeItem<Ast.Identifier, ScopeItemKind.LetVariable>;

export interface ParameterScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Parameter;
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly type: Constant.PrimitiveTypeConstant | undefined;
}

export type RecordFieldScopeItem = IKeyValuePairScopeItem<Ast.GeneralizedIdentifier, ScopeItemKind.RecordField>;

export type SectionMemberScopeItem = IKeyValuePairScopeItem<Ast.Identifier, ScopeItemKind.SectionMember>;

export interface UndefinedScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Undefined;
    readonly xorNode: TXorNode;
}
