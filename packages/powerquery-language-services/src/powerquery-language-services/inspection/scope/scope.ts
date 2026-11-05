// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { BindingScopeMap, MergedScopeMap } from "./scopeBindings";

export type ScopeItemTypeResolver = (scopeItem: TScopeItem) => Promise<Type.TPowerQueryType>;

export interface ScopeItemTypeGroup {
    readonly scopeItem: TScopeItem;
    readonly keys: string[];
}

// State for lazy scope-item type resolution; successful results are cached by scopeUtils.
export interface ScopeTypeByKey {
    readonly nodeScope: NodeScope;
    readonly resolver: ScopeItemTypeResolver;
    readonly resolved: Map<string, Type.TPowerQueryType>;
}

// Shared scope data; scopeBindingsUtils provides lookup and iteration over each representation.
export type ScopeMap<T extends object> = ReadonlyMap<string, T> | BindingScopeMap<T> | MergedScopeMap<T>;

export type TriedNodeScope = PQP.Result<NodeScope, PQP.CommonError.CommonError>;

// Caches scopes by node ID and completed inspections for one document.
// Owned by its TypeCache (or explicitly by a standalone inspection caller).
// Scope publication and completed inspection are distinct: parents can publish child scopes
// before those children have been inspected.
export interface ScopeById {
    readonly scopes: Map<number, NodeScope>;
    inspectedNodes: WeakSet<TXorNode["node"]>;
}

// Scope that was generated for a specific nodeId.
// Has the potential to be reused for its child nodes.
export interface NodeScope {
    readonly createdForNodeId: number | undefined;
    // Mostly a tag for debugging.
    // May be a structurally shared read-only view, rather than a native Map.
    readonly scopeItemByKey: ScopeMap<TScopeItem>;
}

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
    readonly annotation?: XorNode<Ast.AsType | Ast.AsNullablePrimitiveType>;
}

export type RecordFieldScopeItem = IKeyValuePairScopeItem<Ast.GeneralizedIdentifier, ScopeItemKind.RecordField>;

export type SectionMemberScopeItem = IKeyValuePairScopeItem<Ast.Identifier, ScopeItemKind.SectionMember>;

export interface UndefinedScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Undefined;
    readonly xorNode: TXorNode;
}
