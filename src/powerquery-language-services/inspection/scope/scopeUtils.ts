// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import {
    AstNodeById,
    ParentIdById,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser/nodeIdMap/nodeIdMap";
import {
    EachExpression,
    FunctionExpression,
    LetExpression,
    RecordExpression,
    RecordLiteral,
    SectionMember,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/ast/ast";
import {
    EachScopeItem,
    LetVariableScopeItem,
    NodeScope,
    ParameterScopeItem,
    RecordFieldScopeItem,
    ScopeItemKind,
    SectionMemberScopeItem,
    TScopeItem,
    UndefinedScopeItem,
} from "./scope";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export * from "./scope";
export * from "./scopeInspection";

export function isEach(maybeValue: TScopeItem | undefined): maybeValue is EachScopeItem {
    return maybeValue?.kind === ScopeItemKind.Each;
}

export function isLetVariable(maybeValue: TScopeItem | undefined): maybeValue is LetVariableScopeItem {
    return maybeValue?.kind === ScopeItemKind.LetVariable;
}

export function isParameter(maybeValue: TScopeItem | undefined): maybeValue is ParameterScopeItem {
    return maybeValue?.kind === ScopeItemKind.Parameter;
}

export function isRecordField(maybeValue: TScopeItem | undefined): maybeValue is RecordFieldScopeItem {
    return maybeValue?.kind === ScopeItemKind.RecordField;
}

export function isSectionMember(maybeValue: TScopeItem | undefined): maybeValue is SectionMemberScopeItem {
    return maybeValue?.kind === ScopeItemKind.SectionMember;
}

export function isUndefined(maybeValue: TScopeItem | undefined): maybeValue is UndefinedScopeItem {
    return maybeValue?.kind === ScopeItemKind.Undefined;
}

export function findScopeItemByLiteral(
    nodeScope: NodeScope | undefined,
    literalString: string,
): TScopeItem | undefined {
    // eslint-disable-next-line no-nested-ternary
    return nodeScope?.has(`@${literalString}`)
        ? nodeScope.get(`@${literalString}`)
        : nodeScope?.has(literalString)
        ? nodeScope.get(literalString)
        : undefined;
}

export function findTheCreatorIdentifierOfOneScopeItem(
    scopeItem: TScopeItem | undefined,
): Ast.Identifier | Ast.GeneralizedIdentifier | undefined {
    if (!scopeItem) return undefined;

    switch (scopeItem.kind) {
        case ScopeItemKind.Parameter:
            return scopeItem.name;
        case ScopeItemKind.LetVariable:
            return scopeItem.key;
        case ScopeItemKind.RecordField:
            return scopeItem.key;
        case ScopeItemKind.SectionMember:
            return scopeItem.key;
        case ScopeItemKind.Each:
        case ScopeItemKind.Undefined:
        default:
            return undefined;
    }
}

export function findDirectUpperScopeExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): EachExpression | FunctionExpression | LetExpression | RecordExpression | RecordLiteral | SectionMember | undefined {
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    const parentIdById: ParentIdById = nodeIdMapCollection.parentIdById;

    let theNode: Ast.TNode | undefined = astNodeById.get(nodeId);

    while (
        theNode &&
        theNode.kind !== Ast.NodeKind.EachExpression &&
        theNode.kind !== Ast.NodeKind.FunctionExpression &&
        theNode.kind !== Ast.NodeKind.LetExpression &&
        theNode.kind !== Ast.NodeKind.RecordExpression &&
        theNode.kind !== Ast.NodeKind.RecordLiteral &&
        theNode.kind !== Ast.NodeKind.Section
    ) {
        const curParentId: number = parentIdById.get(theNode.id) || -1;
        theNode = astNodeById.get(curParentId);
    }

    return theNode as
        | EachExpression
        | FunctionExpression
        | LetExpression
        | RecordExpression
        | RecordLiteral
        | SectionMember
        | undefined;
}
