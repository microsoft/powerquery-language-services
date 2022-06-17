// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as PQP from "@microsoft/powerquery-parser";
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
    return nodeScope?.get(literalString);
}

export function maybeScopeCreatorIdentifier(
    scopeItem: TScopeItem | undefined,
): Ast.Identifier | Ast.GeneralizedIdentifier | undefined {
    if (!scopeItem) {
        return undefined;
    }

    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Undefined:
            return undefined;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
        case ScopeItemKind.SectionMember:
            return scopeItem.key;

        case ScopeItemKind.Parameter:
            return scopeItem.name;

        default:
            throw PQP.Assert.isNever(scopeItem);
    }
}

export function findDirectUpperScopeExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
): EachExpression | FunctionExpression | LetExpression | RecordExpression | RecordLiteral | SectionMember | undefined {
    const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
    const parentIdById: ParentIdById = nodeIdMapCollection.parentIdById;

    let currentNode: Ast.TNode | undefined = astNodeById.get(nodeId);

    while (
        currentNode &&
        currentNode.kind !== Ast.NodeKind.EachExpression &&
        currentNode.kind !== Ast.NodeKind.FunctionExpression &&
        currentNode.kind !== Ast.NodeKind.LetExpression &&
        currentNode.kind !== Ast.NodeKind.RecordExpression &&
        currentNode.kind !== Ast.NodeKind.RecordLiteral &&
        currentNode.kind !== Ast.NodeKind.SectionMember
    ) {
        const currentParentId: number = parentIdById.get(currentNode.id) || -1;
        currentNode = astNodeById.get(currentParentId);
    }

    return currentNode as
        | EachExpression
        | FunctionExpression
        | LetExpression
        | RecordExpression
        | RecordLiteral
        | SectionMember
        | undefined;
}
