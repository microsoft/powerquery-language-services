// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert, MapUtils, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { Inspection, InspectionTraceConstant, TraceUtils } from "../..";
import {
    LetVariableScopeItem,
    NodeScope,
    ParameterScopeItem,
    RecordFieldScopeItem,
    ScopeById,
    ScopeItemKind,
    SectionMemberScopeItem,
    TriedNodeScope,
    TScopeItem,
} from "./scope";
import {
    PseduoFunctionExpressionType,
    pseudoFunctionExpressionType,
    PseudoFunctionParameterType,
} from "../pseudoFunctionExpressionType";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

// Builds a scope for the given node.
export async function tryNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): Promise<TriedNodeScope> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        tryNodeScope.name,
        settings.maybeInitialCorrelationId,
    );

    const updatedSettings: PQP.CommonSettings = {
        ...settings,
        maybeInitialCorrelationId: trace.id,
    };

    const result: TriedNodeScope = await ResultUtils.ensureResultAsync(async () => {
        const ancestry: ReadonlyArray<TXorNode> = AncestryUtils.assertGetAncestry(nodeIdMapCollection, nodeId);

        if (ancestry.length === 0) {
            return new Map();
        }

        const inspectedDeltaScope: ScopeById = await inspectScope(
            updatedSettings,
            nodeIdMapCollection,
            ancestry,
            scopeById,
            trace.id,
        );

        const result: NodeScope = MapUtils.assertGet(inspectedDeltaScope, nodeId, `expected nodeId in scope result`, {
            nodeId,
        });

        for (const [key, value] of inspectedDeltaScope.entries()) {
            scopeById.set(key, value);
        }

        return result;
    }, updatedSettings.locale);

    trace.exit();

    return result;
}

export async function assertGetOrCreateNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): Promise<Inspection.TriedNodeScope> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        assertGetOrCreateNodeScope.name,
        settings.maybeInitialCorrelationId,
    );

    const updatedSettings: PQP.CommonSettings = {
        ...settings,
        maybeInitialCorrelationId: trace.id,
    };

    const maybeScope: NodeScope | undefined = scopeById.get(nodeId);

    if (maybeScope !== undefined) {
        trace.exit({ [TraceConstant.IsThrowing]: false });

        return ResultUtils.boxOk(maybeScope);
    }

    const triedNodeScope: TriedNodeScope = await tryNodeScope(updatedSettings, nodeIdMapCollection, nodeId, scopeById);

    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw triedNodeScope;
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return triedNodeScope;
}

// Recusrive deference of the identifier until it reaches the value node.
// Does not handle recursive identifiers.
export async function maybeDereferencedIdentifier(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    // If a map is given, then it's mutated and returned.
    // Else create a new Map instance and return that instead.
    scopeById: ScopeById = new Map(),
): Promise<PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError>> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        maybeDereferencedIdentifier.name,
        settings.maybeInitialCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    const updatedSettings: PQP.CommonSettings = {
        ...settings,
        maybeInitialCorrelationId: trace.id,
    };

    XorNodeUtils.assertIsIdentifier(xorNode);

    if (XorNodeUtils.isContextXor(xorNode)) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return ResultUtils.boxOk(undefined);
    }

    const identifier: Ast.Identifier | Ast.IdentifierExpression = xorNode.node as
        | Ast.Identifier
        | Ast.IdentifierExpression;

    let identifierLiteral: string;
    let isIdentifierRecurisve: boolean;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
            identifierLiteral = identifier.literal;
            isIdentifierRecurisve = false;
            break;

        case Ast.NodeKind.IdentifierExpression:
            identifierLiteral = identifier.identifier.literal;
            isIdentifierRecurisve = identifier.maybeInclusiveConstant !== undefined;
            break;

        default:
            throw Assert.isNever(identifier);
    }

    const triedNodeScope: Inspection.TriedNodeScope = await assertGetOrCreateNodeScope(
        updatedSettings,
        nodeIdMapCollection,
        xorNode.node.id,
        scopeById,
    );

    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.Result]: triedNodeScope.kind });

        return triedNodeScope;
    }

    const nodeScope: NodeScope = triedNodeScope.value;
    const maybeScopeItem: TScopeItem | undefined = nodeScope.get(identifierLiteral);

    if (
        // If the identifier couldn't be found in the generated scope,
        // then either the scope generation is incorrect or it's an external identifier.
        maybeScopeItem?.isRecursive !== isIdentifierRecurisve
    ) {
        trace.exit({ [TraceConstant.Result]: undefined });

        return ResultUtils.boxOk(undefined);
    }

    const scopeItem: TScopeItem = maybeScopeItem;

    let maybeNextXorNode: TXorNode | undefined;

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

    let result: Promise<PQP.Result<TXorNode | undefined, PQP.CommonError.CommonError>>;

    if (maybeNextXorNode === undefined) {
        result = Promise.resolve(ResultUtils.boxOk(xorNode));
    } else if (
        XorNodeUtils.isContextXor(maybeNextXorNode) ||
        (maybeNextXorNode.node.kind !== Ast.NodeKind.Identifier &&
            maybeNextXorNode.node.kind !== Ast.NodeKind.IdentifierExpression)
    ) {
        result = Promise.resolve(ResultUtils.boxOk(xorNode));
    } else {
        result = maybeDereferencedIdentifier(updatedSettings, nodeIdMapCollection, maybeNextXorNode, scopeById);
    }

    trace.exit();

    return result;
}

interface ScopeInspectionState extends Pick<PQP.CommonSettings, "traceManager"> {
    readonly givenScope: ScopeById;
    readonly deltaScope: ScopeById;
    readonly ancestry: ReadonlyArray<TXorNode>;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    ancestryIndex: number;
}

async function inspectScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    ancestry: ReadonlyArray<TXorNode>,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
    correlationId: number,
): Promise<ScopeById> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectScope.name,
        correlationId,
    );

    const rootId: number = ancestry[0].node.id;

    // A scope for the given ancestry has already been generated.
    const maybeCached: NodeScope | undefined = scopeById.get(rootId);

    if (maybeCached !== undefined) {
        trace.exit();

        return scopeById;
    }

    const state: ScopeInspectionState = {
        traceManager: settings.traceManager,
        givenScope: scopeById,
        // Store the delta between the given scope and what's found in a temporary map.
        // This will prevent mutation in the given map if an error is thrown.
        deltaScope: new Map(),
        ancestry,
        nodeIdMapCollection,
        ancestryIndex: 0,
    };

    // Build up the scope through a top-down inspection.
    const numNodes: number = ancestry.length;

    for (let ancestryIndex: number = numNodes - 1; ancestryIndex >= 0; ancestryIndex -= 1) {
        state.ancestryIndex = ancestryIndex;
        const xorNode: TXorNode = ancestry[ancestryIndex];

        // eslint-disable-next-line no-await-in-loop
        await inspectNode(state, xorNode, trace.id);
    }

    trace.exit();

    return state.deltaScope;
}

// eslint-disable-next-line require-await
async function inspectNode(state: ScopeInspectionState, xorNode: TXorNode, correlationId: number): Promise<void> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectNode.name,
        correlationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode, trace.id);
            break;

        case Ast.NodeKind.Section:
            inspectSection(state, xorNode, trace.id);
            break;

        default:
            localGetOrCreateNodeScope(state, xorNode.node.id, undefined, trace.id);
    }

    trace.exit();
}

function inspectEachExpression(state: ScopeInspectionState, eachExpr: TXorNode, correlationId: number): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectEachExpression.name,
        correlationId,
    );

    XorNodeUtils.assertIsNodeKind<Ast.EachExpression>(eachExpr, Ast.NodeKind.EachExpression);

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
        trace.id,
    );

    trace.exit();
}

function inspectFunctionExpression(state: ScopeInspectionState, fnExpr: TXorNode, correlationId: number): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectFunctionExpression.name,
        correlationId,
    );

    XorNodeUtils.assertIsNodeKind<Ast.FunctionExpression>(fnExpr, Ast.NodeKind.FunctionExpression);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, fnExpr.node.id, undefined, trace.id);
    const pseudoType: PseduoFunctionExpressionType = pseudoFunctionExpressionType(state.nodeIdMapCollection, fnExpr);

    const newEntries: ReadonlyArray<[string, ParameterScopeItem]> = pseudoType.parameters.map(
        (parameter: PseudoFunctionParameterType) => [
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
                        ? TypeUtils.maybePrimitiveTypeConstantKindFromTypeKind(parameter.maybeType)
                        : undefined,
            },
        ],
    );

    expandChildScope(state, fnExpr, [3], newEntries, nodeScope, trace.id);
    trace.exit();
}

function inspectLetExpression(state: ScopeInspectionState, letExpr: TXorNode, correlationId: number): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectLetExpression.name,
        correlationId,
    );

    XorNodeUtils.assertIsNodeKind<Ast.LetExpression>(letExpr, Ast.NodeKind.LetExpression);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, letExpr.node.id, undefined, trace.id);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.LetKeyValuePair> = NodeIdMapIterator.iterLetExpression(
        state.nodeIdMapCollection,
        letExpr,
    );

    inspectKeyValuePairs(state, nodeScope, keyValuePairs, createLetVariableScopeItem, trace.id);

    // Places the assignments from the 'let' into LetExpression.expression
    const newEntries: ReadonlyArray<[string, LetVariableScopeItem]> = scopeItemsFromKeyValuePairs(
        keyValuePairs,
        -1,
        createLetVariableScopeItem,
    );

    expandChildScope(state, letExpr, [3], newEntries, nodeScope, trace.id);
    trace.exit();
}

function inspectRecordExpressionOrRecordLiteral(
    state: ScopeInspectionState,
    record: TXorNode,
    correlationId: number,
): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectRecordExpressionOrRecordLiteral.name,
        correlationId,
    );

    XorNodeUtils.assertIsRecord(record);

    // Propegates the parent's scope.
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, record.node.id, undefined, trace.id);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.RecordKeyValuePair> = NodeIdMapIterator.iterRecord(
        state.nodeIdMapCollection,
        record,
    );

    inspectKeyValuePairs(state, nodeScope, keyValuePairs, createRecordMemberScopeItem, trace.id);
    trace.exit();
}

function inspectSection(state: ScopeInspectionState, section: TXorNode, correlationId: number): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectSection.name,
        correlationId,
    );

    XorNodeUtils.assertIsNodeKind<Ast.Section>(section, Ast.NodeKind.Section);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.SectionKeyValuePair> = NodeIdMapIterator.iterSection(
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
            expandScope(state, kvp.maybeValue, newScopeItems, new Map(), trace.id);
        }
    }

    trace.exit();
}

// Expands the scope on the value part of the key value pair.
function inspectKeyValuePairs<T extends TScopeItem, KVP extends NodeIdMapIterator.TKeyValuePair>(
    state: ScopeInspectionState,
    parentScope: NodeScope,
    keyValuePairs: ReadonlyArray<KVP>,
    createFn: (keyValuePair: KVP, recursive: boolean) => T,
    correlationId: number,
): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectKeyValuePairs.name,
        correlationId,
    );

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
            expandScope(state, kvp.maybeValue, newScopeItems, parentScope, trace.id);
        }
    }

    trace.exit();
}

function expandScope(
    state: ScopeInspectionState,
    xorNode: TXorNode,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: NodeScope | undefined,
    correlationId: number,
): void {
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, xorNode.node.id, maybeDefaultScope, correlationId);

    for (const [key, value] of newEntries) {
        nodeScope.set(value.isRecursive ? `@${key}` : key, value);
    }
}

function expandChildScope(
    state: ScopeInspectionState,
    parent: TXorNode,
    childAttributeIds: ReadonlyArray<number>,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: NodeScope | undefined,
    correlationId: number,
): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const parentId: number = parent.node.id;

    // TODO: optimize this
    for (const attributeId of childAttributeIds) {
        const maybeChild: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
            nodeIdMapCollection,
            parentId,
            attributeId,
        );

        if (maybeChild !== undefined) {
            expandScope(state, maybeChild, newEntries, maybeDefaultScope, correlationId);
        }
    }
}

// Any operation done on a scope should first invoke `scopeFor` for data integrity.
function localGetOrCreateNodeScope(
    state: ScopeInspectionState,
    nodeId: number,
    maybeDefaultScope: NodeScope | undefined,
    correlationId: number,
): NodeScope {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        localGetOrCreateNodeScope.name,
        correlationId,
        {
            nodeId,
        },
    );

    // If scopeFor has already been called then there should be a nodeId in the deltaScope.
    const maybeDeltaScope: NodeScope | undefined = state.deltaScope.get(nodeId);

    if (maybeDeltaScope !== undefined) {
        trace.exit({ [TraceConstant.Result]: "deltaScope cache hit" });

        return maybeDeltaScope;
    }

    // If given a scope with an existing value then assume it's valid.
    // Cache and return.
    const maybeGivenScope: NodeScope | undefined = state.givenScope.get(nodeId);

    if (maybeGivenScope !== undefined) {
        const shallowCopy: NodeScope = new Map(maybeGivenScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        trace.exit({ [TraceConstant.Result]: "givenScope cache hit" });

        return shallowCopy;
    }

    if (maybeDefaultScope !== undefined) {
        const shallowCopy: NodeScope = new Map(maybeDefaultScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        trace.exit({ [TraceConstant.Result]: "defaultScope entry" });

        return shallowCopy;
    }

    // Default to a parent's scope if the node has a parent.
    const maybeParent: TXorNode | undefined = NodeIdMapUtils.maybeParentXor(state.nodeIdMapCollection, nodeId);

    if (maybeParent !== undefined) {
        const parentNodeId: number = maybeParent.node.id;

        const maybeParentDeltaScope: NodeScope | undefined = state.deltaScope.get(parentNodeId);

        if (maybeParentDeltaScope !== undefined) {
            const shallowCopy: NodeScope = new Map(maybeParentDeltaScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            trace.exit({ [TraceConstant.Result]: "parent deltaScope hit" });

            return shallowCopy;
        }

        const maybeParentGivenScope: NodeScope | undefined = state.givenScope.get(parentNodeId);

        if (maybeParentGivenScope !== undefined) {
            const shallowCopy: NodeScope = new Map(maybeParentGivenScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            trace.exit({ [TraceConstant.Result]: "parent givenScope hit" });

            return shallowCopy;
        }
    }

    // The node has no parent or it hasn't been visited.
    const newScope: NodeScope = new Map();
    state.deltaScope.set(nodeId, newScope);
    trace.exit({ [TraceConstant.Result]: "set new entry" });

    return newScope;
}

function scopeItemsFromKeyValuePairs<T extends TScopeItem, KVP extends NodeIdMapIterator.TKeyValuePair>(
    keyValuePairs: ReadonlyArray<KVP>,
    ancestorKeyNodeId: number,
    createFn: (keyValuePair: KVP, isRecursive: boolean) => T,
): ReadonlyArray<[string, T]> {
    return keyValuePairs
        .filter((keyValuePair: KVP) => keyValuePair.maybeValue !== undefined)
        .map((keyValuePair: KVP) => [
            keyValuePair.keyLiteral,
            createFn(keyValuePair, ancestorKeyNodeId === keyValuePair.key.id),
        ]);
}

function createSectionMemberScopeItem(
    keyValuePair: NodeIdMapIterator.SectionKeyValuePair,
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
    keyValuePair: NodeIdMapIterator.LetKeyValuePair,
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
    keyValuePair: NodeIdMapIterator.RecordKeyValuePair,
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
