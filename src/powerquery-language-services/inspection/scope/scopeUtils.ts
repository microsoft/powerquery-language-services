// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import {
    EachScopeItem,
    LetVariableScopeItem,
    NodeScope,
    ParameterScopeItem,
    RecordFieldScopeItem,
    ScopeById,
    ScopeItemKind,
    ScopeItemTypeResolver,
    ScopeTypeByKey,
    SectionMemberScopeItem,
    TScopeItem,
    UndefinedScopeItem,
} from "./scope";
import { scopeMapEntries, scopeMapGet } from "./scopeBindingsUtils";

export * from "./scope";
export * from "./scopeInspection";

export function createScopeById(): ScopeById {
    return { scopes: new Map(), inspectedNodes: new WeakSet() };
}

export function setScopeById(state: ScopeById, nodeId: number, scope: NodeScope): void {
    const previous: NodeScope | undefined = state.scopes.get(nodeId);

    // Adding new scopes is normal inspection work; replacing one invalidates completion.
    if (previous !== undefined && previous !== scope) {
        state.inspectedNodes = new WeakSet();
    }

    state.scopes.set(nodeId, scope);
}

export function deleteScopeById(state: ScopeById, nodeId: number): boolean {
    const deleted: boolean = state.scopes.delete(nodeId);

    if (deleted) {
        state.inspectedNodes = new WeakSet();
    }

    return deleted;
}

export function clearScopeById(state: ScopeById): void {
    state.scopes.clear();
    state.inspectedNodes = new WeakSet();
}

export function emptyScopeTypeByKey(): ScopeTypeByKey {
    return createScopeTypeByKey(
        {
            createdForNodeId: undefined,
            scopeItemByKey: new Map(),
        },
        (_scopeItem: TScopeItem) => Promise.resolve(Type.AnyInstance),
    );
}

// Keep the full scope available while resolving and retaining only the types callers request.
export function createScopeTypeByKey(nodeScope: NodeScope, resolver: ScopeItemTypeResolver): ScopeTypeByKey {
    return { nodeScope, resolver, resolved: new Map() };
}

export async function resolveType(state: ScopeTypeByKey, key: string): Promise<Type.TPowerQueryType | undefined> {
    const cached: Type.TPowerQueryType | undefined = state.resolved.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const scopeItem: TScopeItem | undefined = scopeMapGet(state.nodeScope.scopeItemByKey, key);

    if (scopeItem === undefined) {
        return undefined;
    }

    const type: Type.TPowerQueryType = await state.resolver(scopeItem);
    state.resolved.set(key, type);

    return type;
}

export async function resolveAll(state: ScopeTypeByKey): Promise<ReadonlyMap<string, Type.TPowerQueryType>> {
    // Inspect each unresolved syntax node once: concurrent alias resolution can appear
    // recursive to the type inspector's cycle detector.
    const keysByNodeId: Map<number, string[]> = new Map();
    const firstScopeItemByNodeId: Map<number, TScopeItem> = new Map();

    for (const [key, scopeItem] of scopeMapEntries(state.nodeScope.scopeItemByKey)) {
        if (!state.resolved.has(key)) {
            const existing: string[] | undefined = keysByNodeId.get(scopeItem.nodeId);

            if (existing) {
                existing.push(key);
            } else {
                keysByNodeId.set(scopeItem.nodeId, [key]);
                firstScopeItemByNodeId.set(scopeItem.nodeId, scopeItem);
            }
        }
    }

    const nodeIds: number[] = [...keysByNodeId.keys()];

    const resolvedTypes: Type.TPowerQueryType[] = await Promise.all(
        nodeIds.map((nodeId: number) => state.resolver(firstScopeItemByNodeId.get(nodeId)!)),
    );

    for (let index: number = 0; index < nodeIds.length; index += 1) {
        for (const key of keysByNodeId.get(nodeIds[index])!) {
            state.resolved.set(key, resolvedTypes[index]);
        }
    }

    return state.resolved;
}

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
    const scopeItem: TScopeItem | undefined = scopeMapGet(nodeScope.scopeItemByKey, key);

    if (scopeItem?.kind !== kind) {
        return undefined;
    }

    return scopeItem as T;
}

export function findScopeItemByLiteral(
    nodeScope: NodeScope | undefined,
    literalString: string,
): TScopeItem | undefined {
    return nodeScope === undefined ? undefined : scopeMapGet(nodeScope.scopeItemByKey, literalString);
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
