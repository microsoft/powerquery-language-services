// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

// Keys are identifier literals.
export type ScopeTypeByKey = Map<string, Type.TPowerQueryType>;

export type TriedNodeScope = PQP.Result<NodeScope, PQP.CommonError.CommonError>;

// Scopes for multiple nodes, where the keys are nodeIds.
// Serves as a cache when building the scope for a specific node.
export type ScopeById = Map<number, NodeScope>;

// Scope for a specific node.
export type NodeScope = Map<string, TScopeItem>;

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
    readonly id: number;
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
