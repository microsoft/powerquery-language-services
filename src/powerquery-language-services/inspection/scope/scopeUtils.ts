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
    const scopeItem: TScopeItem | undefined = nodeScope.get(key);

    if (scopeItem?.kind !== kind) {
        return undefined;
    }

    return scopeItem as T;
}

export function findScopeItemByLiteral(
    nodeScope: NodeScope | undefined,
    literalString: string,
): TScopeItem | undefined {
    if (nodeScope === undefined) {
        return undefined;
    }

    // Phase 8.2: Use enhanced lookup to handle both lazy and full mode scopes
    // This handles mixed scopes where some may have full variants and others lazy variants
    return findScopeItemWithVariants(nodeScope, literalString);
}

// Phase 8.2: Enhanced scope lookup that handles both full and lazy modes
function findScopeItemWithVariants(nodeScope: NodeScope, identifier: string): TScopeItem | undefined {
    // Phase 8.2: Fast path - direct lookup first (handles both full and lazy modes)
    let item: TScopeItem | undefined = nodeScope.get(identifier);

    if (item !== undefined) {
        return item;
    }

    // Phase 8.2: Enhanced variant checking for mixed storage modes
    // Try canonical form lookups (works for lazy mode)
    let canonicalForm: string = identifier;

    // Remove @ prefix to get canonical form
    if (identifier.startsWith("@")) {
        canonicalForm = identifier.substring(1);

        // Handle @#"name" -> #"name"
        if (canonicalForm.startsWith('#"') && canonicalForm.endsWith('"')) {
            item = nodeScope.get(canonicalForm);

            if (item !== undefined) {
                return item;
            }
        } else {
            // Handle @name -> name
            item = nodeScope.get(canonicalForm);

            if (item !== undefined) {
                return item;
            }
        }
    }

    // Handle #"name" -> name (remove generalized identifier quotes)
    if (identifier.startsWith('#"') && identifier.endsWith('"')) {
        canonicalForm = identifier.slice(2, -1);
        item = nodeScope.get(canonicalForm);

        if (item !== undefined) {
            return item;
        }
    }

    // Phase 8.2: Reverse lookup for cases where full mode was used
    // Check if any variant forms exist in the scope (needed for full mode compatibility)
    for (const [storedKey] of nodeScope.entries()) {
        // Check @ variants
        if (storedKey === `@${identifier}`) {
            return nodeScope.get(storedKey);
        }

        // Check #"name" variants
        if (storedKey === `#"${identifier}"`) {
            return nodeScope.get(storedKey);
        }

        // Check @#"name" variants
        if (storedKey === `@#"${identifier}"`) {
            return nodeScope.get(storedKey);
        }
    }

    return undefined;
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
