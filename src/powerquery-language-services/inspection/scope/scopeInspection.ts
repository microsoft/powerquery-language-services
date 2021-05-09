// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { Inspection } from "../..";
import {
    PseduoFunctionExpressionType,
    pseudoFunctionExpressionType,
    PseudoFunctionParameterType,
} from "../pseudoFunctionExpressionType";
import {
    LetVariableScopeItem,
    NodeScope,
    ParameterScopeItem,
    RecordFieldScopeItem,
    ScopeById,
    ScopeItemKind,
    SectionMemberScopeItem,
    TriedNodeScope,
    TriedScope,
    TScopeItem,
} from "./scope";

// Builds scopes for multiple nodes using a top-down approach,
// starting from the ancestry's root and finishing on the the ancestry's leaf.
export function tryScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    ancestry: ReadonlyArray<PQP.Parser.TXorNode>,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: ScopeById | undefined,
): TriedScope {
    return PQP.ResultUtils.ensureResult(settings.locale, () =>
        inspectScope(settings, nodeIdMapCollection, ancestry, maybeScopeById),
    );
}

// Builds a scope for the given node.
export function tryNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    nodeId: number,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: ScopeById | undefined,
): TriedNodeScope {
    return PQP.ResultUtils.ensureResult(settings.locale, () => {
        const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.AncestryUtils.assertGetAncestry(
            nodeIdMapCollection,
            nodeId,
        );
        if (ancestry.length === 0) {
            return new Map();
        }

        const inspected: ScopeById = inspectScope(settings, nodeIdMapCollection, ancestry, maybeScopeById);
        return Assert.asDefined(inspected.get(nodeId), `expected nodeId in scope result`, { nodeId });
    });
}

export function assertGetOrCreateNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    nodeId: number,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    scopeById: ScopeById = new Map(),
): Inspection.TriedNodeScope {
    const maybeScope: NodeScope | undefined = scopeById.get(nodeId);
    if (maybeScope !== undefined) {
        return PQP.ResultUtils.createOk(maybeScope);
    }

    const triedNodeScope: TriedNodeScope = tryNodeScope(settings, nodeIdMapCollection, nodeId, scopeById);
    if (PQP.ResultUtils.isError(triedNodeScope)) {
        throw triedNodeScope;
    }

    return triedNodeScope;
}

// Recusrive deference of the identifier until it reaches the value node.
// Does not handle recursive identifiers.
export function maybeDereferencedIdentifier(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    xorNode: PQP.Parser.TXorNode,
    // If a map is given, then it's mutated and returned.
    // Else create a new Map instance and return that instead.
    scopeById: ScopeById = new Map(),
): PQP.Result<PQP.Parser.TXorNode | undefined, PQP.CommonError.CommonError> {
    PQP.Parser.XorNodeUtils.assertIsIdentifier(xorNode);

    if (PQP.Parser.XorNodeUtils.isContext(xorNode)) {
        return PQP.ResultUtils.createOk(undefined);
    }
    const identifier: PQP.Language.Ast.Identifier | PQP.Language.Ast.IdentifierExpression = xorNode.node as
        | PQP.Language.Ast.Identifier
        | PQP.Language.Ast.IdentifierExpression;

    let identifierLiteral: string;
    let isIdentifierRecurisve: boolean;

    switch (identifier.kind) {
        case PQP.Language.Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isIdentifierRecurisve = false;
            break;

        case PQP.Language.Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isIdentifierRecurisve = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    const triedNodeScope: Inspection.TriedNodeScope = assertGetOrCreateNodeScope(
        settings,
        nodeIdMapCollection,
        xorNode.node.id,
        scopeById,
    );
    if (PQP.ResultUtils.isError(triedNodeScope)) {
        return triedNodeScope;
    }

    const nodeScope: NodeScope = triedNodeScope.value;
    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);
    if (
        // If the identifier couldn't be found in the generated scope,
        // then either the scope generation is incorrect or it's an external identifier.
        maybeScopeItem?.isRecursive !== isIdentifierRecurisve
    ) {
        return PQP.ResultUtils.createOk(undefined);
    }
    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: PQP.Parser.TXorNode | undefined;
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
        case ScopeItemKind.Parameter:
        case ScopeItemKind.Undefined:
            break;

        case ScopeItemKind.LetVariable:
        case ScopeItemKind.RecordField:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        case ScopeItemKind.SectionMember:
            maybeNextXorNode = scopeItem.maybeValue;
            break;

        default:
            throw Assert.isNever(scopeItem);
    }

    if (maybeNextXorNode === undefined) {
        return PQP.ResultUtils.createOk(xorNode);
    } else if (
        PQP.Parser.XorNodeUtils.isContext(maybeNextXorNode) ||
        (maybeNextXorNode.node.kind !== PQP.Language.Ast.NodeKind.Identifier &&
            maybeNextXorNode.node.kind !== PQP.Language.Ast.NodeKind.IdentifierExpression)
    ) {
        return PQP.ResultUtils.createOk(xorNode);
    } else {
        return maybeDereferencedIdentifier(settings, nodeIdMapCollection, maybeNextXorNode, scopeById);
    }
}

interface ScopeInspectionState {
    readonly settings: PQP.CommonSettings;
    readonly givenScope: ScopeById;
    readonly deltaScope: ScopeById;
    readonly ancestry: ReadonlyArray<PQP.Parser.TXorNode>;
    readonly nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection;
    ancestryIndex: number;
}

function inspectScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    ancestry: ReadonlyArray<PQP.Parser.TXorNode>,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: ScopeById | undefined,
): ScopeById {
    const rootId: number = ancestry[0].node.id;

    let scopeById: ScopeById;
    if (maybeScopeById !== undefined) {
        const maybeCached: NodeScope | undefined = maybeScopeById.get(rootId);
        if (maybeCached !== undefined) {
            return maybeScopeById;
        }
        scopeById = maybeScopeById;
    } else {
        scopeById = new Map();
    }

    // Store the delta between the given scope and what's found in a temporary map.
    // This will prevent mutation in the given map if an error is thrown.
    const scopeChanges: ScopeById = new Map();
    const state: ScopeInspectionState = {
        settings,
        givenScope: scopeById,
        deltaScope: scopeChanges,
        ancestry,
        nodeIdMapCollection,
        ancestryIndex: 0,
    };

    // Build up the scope through a top-down inspection.
    const numNodes: number = ancestry.length;
    for (let ancestryIndex: number = numNodes - 1; ancestryIndex >= 0; ancestryIndex -= 1) {
        state.ancestryIndex = ancestryIndex;
        const xorNode: PQP.Parser.TXorNode = ancestry[ancestryIndex];

        inspectNode(state, xorNode);
    }

    return state.deltaScope;
}

function inspectNode(state: ScopeInspectionState, xorNode: PQP.Parser.TXorNode): void {
    switch (xorNode.node.kind) {
        case PQP.Language.Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.RecordExpression:
        case PQP.Language.Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode);
            break;

        case PQP.Language.Ast.NodeKind.Section:
            inspectSection(state, xorNode);
            break;

        default:
            localGetOrCreateNodeScope(state, xorNode.node.id, undefined);
    }
}

function inspectEachExpression(state: ScopeInspectionState, eachExpr: PQP.Parser.TXorNode): void {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(eachExpr, PQP.Language.Ast.NodeKind.EachExpression);
    expandChildScope(
        state,
        eachExpr,
        [1],
        [
            [
                "_",
                {
                    kind: ScopeItemKind.Each,
                    id: eachExpr.node.id,
                    isRecursive: false,
                    eachExpression: eachExpr,
                },
            ],
        ],
        undefined,
    );
}

function inspectFunctionExpression(state: ScopeInspectionState, fnExpr: PQP.Parser.TXorNode): void {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(fnExpr, PQP.Language.Ast.NodeKind.FunctionExpression);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, fnExpr.node.id, undefined);
    const pseudoType: PseduoFunctionExpressionType = pseudoFunctionExpressionType(state.nodeIdMapCollection, fnExpr);

    const newEntries: ReadonlyArray<[string, ParameterScopeItem]> = pseudoType.parameters.map(
        (parameter: PseudoFunctionParameterType) => {
            return [
                parameter.name.literal,
                {
                    kind: ScopeItemKind.Parameter,
                    id: parameter.id,
                    isRecursive: false,
                    name: parameter.name,
                    isOptional: parameter.isOptional,
                    isNullable: parameter.isNullable,
                    maybeType:
                        parameter.maybeType !== undefined
                            ? PQP.Language.TypeUtils.maybePrimitiveTypeConstantKindFromTypeKind(parameter.maybeType)
                            : undefined,
                },
            ];
        },
    );
    expandChildScope(state, fnExpr, [3], newEntries, nodeScope);
}

function inspectLetExpression(state: ScopeInspectionState, letExpr: PQP.Parser.TXorNode): void {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(letExpr, PQP.Language.Ast.NodeKind.LetExpression);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, letExpr.node.id, undefined);

    const keyValuePairs: ReadonlyArray<PQP.Parser.NodeIdMapIterator.LetKeyValuePair> = PQP.Parser.NodeIdMapIterator.iterLetExpression(
        state.nodeIdMapCollection,
        letExpr,
    );

    inspectKeyValuePairs(state, nodeScope, keyValuePairs, createLetVariableScopeItem);

    // Places the assignments from the 'let' into LetExpression.expression
    const newEntries: ReadonlyArray<[string, LetVariableScopeItem]> = scopeItemsFromKeyValuePairs(
        keyValuePairs,
        -1,
        createLetVariableScopeItem,
    );
    expandChildScope(state, letExpr, [3], newEntries, nodeScope);
}

function inspectRecordExpressionOrRecordLiteral(state: ScopeInspectionState, record: PQP.Parser.TXorNode): void {
    PQP.Parser.XorNodeUtils.assertIsRecord(record);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, record.node.id, undefined);

    const keyValuePairs: ReadonlyArray<PQP.Parser.NodeIdMapIterator.RecordKeyValuePair> = PQP.Parser.NodeIdMapIterator.iterRecord(
        state.nodeIdMapCollection,
        record,
    );
    inspectKeyValuePairs(state, nodeScope, keyValuePairs, createRecordMemberScopeItem);
}

function inspectSection(state: ScopeInspectionState, section: PQP.Parser.TXorNode): void {
    PQP.Parser.XorNodeUtils.assertAstNodeKind(section, PQP.Language.Ast.NodeKind.Section);

    const keyValuePairs: ReadonlyArray<PQP.Parser.NodeIdMapIterator.SectionKeyValuePair> = PQP.Parser.NodeIdMapIterator.iterSection(
        state.nodeIdMapCollection,
        section,
    );

    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, SectionMemberScopeItem]> = scopeItemsFromKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            createSectionMemberScopeItem,
        );
        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.maybeValue, newScopeItems, new Map());
        }
    }
}

// Expands the scope of the value portion for each key value pair.
function inspectKeyValuePairs<T extends TScopeItem, KVP extends PQP.Parser.NodeIdMapIterator.TKeyValuePair>(
    state: ScopeInspectionState,
    parentScope: NodeScope,
    keyValuePairs: ReadonlyArray<KVP>,
    createFn: (keyValuePair: KVP, recursive: boolean) => T,
): void {
    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, T]> = scopeItemsFromKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            createFn,
        );
        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.maybeValue, newScopeItems, parentScope);
        }
    }
}

function expandScope(
    state: ScopeInspectionState,
    xorNode: PQP.Parser.TXorNode,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: NodeScope | undefined,
): void {
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, xorNode.node.id, maybeDefaultScope);
    for (const [key, value] of newEntries) {
        nodeScope.set(key, value);
    }
}

function expandChildScope(
    state: ScopeInspectionState,
    parent: PQP.Parser.TXorNode,
    childAttributeIds: ReadonlyArray<number>,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: NodeScope | undefined,
): void {
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = state.nodeIdMapCollection;
    const parentId: number = parent.node.id;

    // TODO: optimize this
    for (const attributeId of childAttributeIds) {
        const maybeChild: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
            nodeIdMapCollection,
            parentId,
            attributeId,
            undefined,
        );
        if (maybeChild !== undefined) {
            expandScope(state, maybeChild, newEntries, maybeDefaultScope);
        }
    }
}

// Any operation done on a scope should first invoke `scopeFor` for data integrity.
function localGetOrCreateNodeScope(
    state: ScopeInspectionState,
    nodeId: number,
    maybeDefaultScope: NodeScope | undefined,
): NodeScope {
    // If scopeFor has already been called then there should be a nodeId in the deltaScope.
    const maybeDeltaScope: NodeScope | undefined = state.deltaScope.get(nodeId);
    if (maybeDeltaScope !== undefined) {
        return maybeDeltaScope;
    }

    // If given a scope with an existing value then assume it's valid.
    // Cache and return.
    const maybeGivenScope: NodeScope | undefined = state.givenScope.get(nodeId);
    if (maybeGivenScope !== undefined) {
        const shallowCopy: NodeScope = new Map(maybeGivenScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        return shallowCopy;
    }

    if (maybeDefaultScope !== undefined) {
        const shallowCopy: NodeScope = new Map(maybeDefaultScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        return shallowCopy;
    }

    // Default to a parent's scope if the node has a parent.
    const maybeParent: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeParentXor(
        state.nodeIdMapCollection,
        nodeId,
        undefined,
    );
    if (maybeParent !== undefined) {
        const parentNodeId: number = maybeParent.node.id;

        const maybeParentDeltaScope: NodeScope | undefined = state.deltaScope.get(parentNodeId);
        if (maybeParentDeltaScope !== undefined) {
            const shallowCopy: NodeScope = new Map(maybeParentDeltaScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            return shallowCopy;
        }

        const maybeParentGivenScope: NodeScope | undefined = state.givenScope.get(parentNodeId);
        if (maybeParentGivenScope !== undefined) {
            const shallowCopy: NodeScope = new Map(maybeParentGivenScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            return shallowCopy;
        }
    }

    // The node has no parent or it hasn't been visited.
    const newScope: NodeScope = new Map();
    state.deltaScope.set(nodeId, newScope);
    return newScope;
}

function scopeItemsFromKeyValuePairs<T extends TScopeItem, KVP extends PQP.Parser.NodeIdMapIterator.TKeyValuePair>(
    keyValuePairs: ReadonlyArray<KVP>,
    ancestorKeyNodeId: number,
    createFn: (keyValuePair: KVP, isRecursive: boolean) => T,
): ReadonlyArray<[string, T]> {
    return keyValuePairs
        .filter((keyValuePair: KVP) => keyValuePair.maybeValue !== undefined)
        .map((keyValuePair: KVP) => {
            return [keyValuePair.keyLiteral, createFn(keyValuePair, ancestorKeyNodeId === keyValuePair.key.id)];
        });
}

function createSectionMemberScopeItem(
    keyValuePair: PQP.Parser.NodeIdMapIterator.SectionKeyValuePair,
    isRecursive: boolean,
): SectionMemberScopeItem {
    return {
        kind: ScopeItemKind.SectionMember,
        id: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}

function createLetVariableScopeItem(
    keyValuePair: PQP.Parser.NodeIdMapIterator.LetKeyValuePair,
    isRecursive: boolean,
): LetVariableScopeItem {
    return {
        kind: ScopeItemKind.LetVariable,
        id: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}

function createRecordMemberScopeItem(
    keyValuePair: PQP.Parser.NodeIdMapIterator.RecordKeyValuePair,
    isRecursive: boolean,
): RecordFieldScopeItem {
    return {
        kind: ScopeItemKind.RecordField,
        id: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}
