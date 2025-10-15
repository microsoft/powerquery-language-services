// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as PQP from "@microsoft/powerquery-parser";
import {
    type AstNodeById,
    type ParentIdById,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser/nodeIdMap/nodeIdMap";
import {
    type EachExpression,
    type FunctionExpression,
    type LetExpression,
    type RecordExpression,
    type RecordLiteral,
    type SectionMember,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/ast/ast";
import {
    type EachScopeItem,
    type LetVariableScopeItem,
    type NodeScope,
    type ParameterScopeItem,
    type RecordFieldScopeItem,
    ScopeItemKind,
    type SectionMemberScopeItem,
    type TScopeItem,
    type UndefinedScopeItem,
} from "./scope";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { type NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export * from "./scope";
export * from "./scopeInspection";

export function assertGetScopeItemChecked<T extends TScopeItem>(nodeScope: NodeScope, key: string, kind: T["kind"]): T {
    const scopeItem: T | undefined = getScopeItemChecked(nodeScope, key, kind);

    if (scopeItem === undefined) {
        throw new PQP.CommonError.InvariantError(`expected a '${kind}' scope item with key '${key}'`);
    }

    return scopeItem;
}

export function isEach(value: TScopeItem | undefined): value is EachScopeItem {
    return value?.kind === ScopeItemKind.Each;
}

export function isLetVariable(value: TScopeItem | undefined): value is LetVariableScopeItem {
    return value?.kind === ScopeItemKind.LetVariable;
}

export function isParameter(value: TScopeItem | undefined): value is ParameterScopeItem {
    return value?.kind === ScopeItemKind.Parameter;
}

export function isRecordField(value: TScopeItem | undefined): value is RecordFieldScopeItem {
    return value?.kind === ScopeItemKind.RecordField;
}

export function isSectionMember(value: TScopeItem | undefined): value is SectionMemberScopeItem {
    return value?.kind === ScopeItemKind.SectionMember;
}

export function isUndefined(value: TScopeItem | undefined): value is UndefinedScopeItem {
    return value?.kind === ScopeItemKind.Undefined;
}

export function getScopeItemChecked<T extends TScopeItem>(
    nodeScope: NodeScope,
    key: string,
    kind: T["kind"],
): T | undefined {
    const scopeItem: TScopeItem | undefined = nodeScope.scopeItemByKey.get(key);

    if (scopeItem?.kind !== kind) {
        return undefined;
    }

    return scopeItem as T;
}

export function findScopeItemByLiteral(
    nodeScope: NodeScope | undefined,
    literalString: string,
): TScopeItem | undefined {
    return nodeScope?.scopeItemByKey.get(literalString);
}

export function scopeCreatorIdentifier(
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

    return currentNode;
}
