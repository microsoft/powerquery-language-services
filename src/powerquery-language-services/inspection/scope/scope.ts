// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

// Keys are identifier literals.
export type ScopeTypeByKey = Map<string, PQP.Language.Type.PowerQueryType>;

export type TriedScope = PQP.Result<ScopeById, PQP.CommonError.CommonError>;

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

export const enum ScopeItemKind {
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
    Key extends PQP.Language.Ast.Identifier | PQP.Language.Ast.GeneralizedIdentifier,
    Kind extends ScopeItemKind.LetVariable | ScopeItemKind.RecordField | ScopeItemKind.SectionMember
> extends IScopeItem {
    readonly kind: Kind;
    readonly key: Key;
    readonly maybeValue: PQP.Parser.TXorNode | undefined;
}

export interface EachScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Each;
    readonly eachExpression: PQP.Parser.TXorNode;
}

export type LetVariableScopeItem = IKeyValuePairScopeItem<PQP.Language.Ast.Identifier, ScopeItemKind.LetVariable>;

export interface ParameterScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Parameter;
    readonly name: PQP.Language.Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: PQP.Language.Constant.PrimitiveTypeConstantKind | undefined;
}

export type RecordFieldScopeItem = IKeyValuePairScopeItem<
    PQP.Language.Ast.GeneralizedIdentifier,
    ScopeItemKind.RecordField
>;

export type SectionMemberScopeItem = IKeyValuePairScopeItem<PQP.Language.Ast.Identifier, ScopeItemKind.SectionMember>;

export interface UndefinedScopeItem extends IScopeItem {
    readonly kind: ScopeItemKind.Undefined;
    readonly xorNode: PQP.Parser.TXorNode;
}
