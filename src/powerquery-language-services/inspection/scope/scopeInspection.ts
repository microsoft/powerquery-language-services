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
import { Ast, IdentifierUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ICancellationToken, MapUtils, ResultUtils } from "@microsoft/powerquery-parser";
import { PrimitiveTypeConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";

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
import { TypeById } from "../typeCache";

// Builds a scope for the given node.
export async function tryNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    eachScopeById: TypeById | undefined,
    nodeId: number,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): Promise<TriedNodeScope> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        tryNodeScope.name,
        settings.initialCorrelationId,
    );

    const updatedSettings: PQP.CommonSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    const result: TriedNodeScope = await ResultUtils.ensureResultAsync(async () => {
        const ancestry: ReadonlyArray<TXorNode> = AncestryUtils.assertAncestry(nodeIdMapCollection, nodeId);

        if (ancestry.length === 0) {
            return new Map();
        }

        await inspectScope(updatedSettings, nodeIdMapCollection, eachScopeById, ancestry, scopeById, trace.id);

        const result: NodeScope = MapUtils.assertGet(scopeById, nodeId, `expected nodeId in scope result`, {
            nodeId,
        });

        return result;
    }, updatedSettings.locale);

    trace.exit();

    return result;
}

export async function assertGetOrCreateNodeScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    eachScopeById: TypeById | undefined,
    nodeId: number,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
): Promise<Inspection.TriedNodeScope> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        assertGetOrCreateNodeScope.name,
        settings.initialCorrelationId,
    );

    const updatedSettings: PQP.CommonSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    const nodeScope: NodeScope | undefined = scopeById.get(nodeId);

    if (nodeScope !== undefined) {
        trace.exit({ [TraceConstant.IsThrowing]: false });

        return ResultUtils.ok(nodeScope);
    }

    const triedNodeScope: TriedNodeScope = await tryNodeScope(
        updatedSettings,
        nodeIdMapCollection,
        eachScopeById,
        nodeId,
        scopeById,
    );

    if (ResultUtils.isError(triedNodeScope)) {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw triedNodeScope;
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return triedNodeScope;
}

interface ScopeInspectionState extends Pick<PQP.CommonSettings, "traceManager"> {
    readonly givenScope: ScopeById;
    readonly ancestry: ReadonlyArray<TXorNode>;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly eachScopeById: TypeById | undefined;
    readonly cancellationToken: ICancellationToken | undefined;
    ancestryIndex: number;
}

async function inspectScope(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    eachScopeById: TypeById | undefined,
    ancestry: ReadonlyArray<TXorNode>,
    // scopeById may get mutated by adding new entries.
    scopeById: ScopeById,
    correlationId: number,
): Promise<void> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectScope.name,
        correlationId,
    );

    const rootId: number = ancestry[0].node.id;

    // A scope for the given ancestry has already been generated.
    const cached: NodeScope | undefined = scopeById.get(rootId);

    if (cached !== undefined) {
        trace.exit();

        return;
    }

    const state: ScopeInspectionState = {
        traceManager: settings.traceManager,
        givenScope: scopeById,
        ancestry,
        nodeIdMapCollection,
        eachScopeById,
        cancellationToken: settings.cancellationToken,
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
}

// eslint-disable-next-line require-await
async function inspectNode(state: ScopeInspectionState, xorNode: TXorNode, correlationId: number): Promise<void> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectNode.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
                    nodeId: eachExpr.node.id,
                    isRecursive: false,
                    eachExpression: eachExpr,
                    implicitParameterType: state.eachScopeById?.get(eachExpr.node.id) ?? Type.UnknownInstance,
                },
            ],
        ],
        localGetOrCreateNodeScope(state, eachExpr.node.id, undefined, trace.id),
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

    const newEntries: [string, ParameterScopeItem][] = [];

    for (const parameter of pseudoType.parameters) {
        const type: PrimitiveTypeConstant | undefined = parameter.type
            ? TypeUtils.primitiveTypeConstantKindFromTypeKind(parameter.type)
            : undefined;

        const parameterScopeItem: ParameterScopeItem = scopeItemFactoryForParameter(parameter, type);

        for (const scopeKey of IdentifierUtils.getAllowedIdentifiers(parameter.name.literal)) {
            newEntries.push([scopeKey, parameterScopeItem]);
        }
    }

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

    inspectKeyValuePairs(
        state,
        nodeScope,
        keyValuePairs,
        { allowRecursive: true },
        scopeItemFactoryForLetVariable,
        trace.id,
    );

    // Places the assignments from the 'let' into LetExpression.expression
    const newEntries: ReadonlyArray<[string, LetVariableScopeItem]> = scopeItemFactoryForKeyValuePairs(
        keyValuePairs,
        -1,
        { allowRecursive: true },
        scopeItemFactoryForLetVariable,
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

    inspectKeyValuePairs(
        state,
        nodeScope,
        keyValuePairs,
        {
            allowGeneralizedIdentifier: true,
            allowRecursive: true,
        },
        scopeItemFactoryForRecordMember,
        trace.id,
    );

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
        state.cancellationToken?.throwIfCancelled();

        if (kvp.value === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, SectionMemberScopeItem]> = scopeItemFactoryForKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            { allowRecursive: true },
            scopeItemFactoryForSectionMember,
        );

        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.value, newScopeItems, new Map(), trace.id);
        }
    }

    trace.exit();
}

// Expands the scope on the value part of the key value pair.
function inspectKeyValuePairs<
    T extends Extract<TScopeItem, LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem>,
    KVP extends NodeIdMapIterator.TKeyValuePair,
>(
    state: ScopeInspectionState,
    parentScope: NodeScope,
    keyValuePairs: ReadonlyArray<KVP>,
    getAllowedIdentifiersOptions: IdentifierUtils.GetAllowedIdentifiersOptions,
    scopeItemFactory: (keyValuePair: KVP, recursive: boolean) => T,
    correlationId: number,
): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectKeyValuePairs.name,
        correlationId,
    );

    for (const kvp of keyValuePairs) {
        state.cancellationToken?.throwIfCancelled();

        if (kvp.value === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, T]> = scopeItemFactoryForKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            getAllowedIdentifiersOptions,
            scopeItemFactory,
        );

        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.value, newScopeItems, parentScope, trace.id);
        }
    }

    trace.exit();
}

function expandScope(
    state: ScopeInspectionState,
    xorNode: TXorNode,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    defaultScope: NodeScope | undefined,
    correlationId: number,
): void {
    const nodeScope: NodeScope = localGetOrCreateNodeScope(state, xorNode.node.id, defaultScope, correlationId);

    for (const [key, value] of newEntries) {
        nodeScope.set(key, value);
    }
}

function expandChildScope(
    state: ScopeInspectionState,
    parent: TXorNode,
    childAttributeIds: ReadonlyArray<number>,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    defaultScope: NodeScope | undefined,
    correlationId: number,
): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const parentId: number = parent.node.id;

    // TODO: optimize this
    for (const attributeId of childAttributeIds) {
        const child: TXorNode | undefined = NodeIdMapUtils.nthChildXor(nodeIdMapCollection, parentId, attributeId);

        if (child !== undefined) {
            expandScope(state, child, newEntries, defaultScope, correlationId);
        }
    }
}

// Any operation done on a scope should first invoke `scopeFor` for data integrity.
function localGetOrCreateNodeScope(
    state: ScopeInspectionState,
    nodeId: number,
    defaultScope: NodeScope | undefined,
    correlationId: number,
): NodeScope {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        localGetOrCreateNodeScope.name,
        correlationId,
        { nodeId },
    );

    // If scopeFor has already been called then there should be a nodeId in the givenScope.
    const givenScope: NodeScope | undefined = state.givenScope.get(nodeId);

    if (givenScope !== undefined) {
        trace.exit({ [TraceConstant.Result]: "givenScope cache hit" });

        return givenScope;
    }

    if (defaultScope !== undefined) {
        const shallowCopy: NodeScope = new Map(defaultScope.entries());
        state.givenScope.set(nodeId, shallowCopy);
        trace.exit({ [TraceConstant.Result]: "defaultScope entry" });

        return shallowCopy;
    }

    // Default to a parent's scope if the node has a parent.
    // Special handling is needed for FieldProjection/FieldSelector which should only copy the EachExpression scope.
    const parent: TXorNode | undefined = NodeIdMapUtils.parentXor(state.nodeIdMapCollection, nodeId);

    if (parent !== undefined) {
        const parentNodeId: number = parent.node.id;
        let parentGivenScope: NodeScope | undefined = state.givenScope.get(parentNodeId);

        // Phase 2.6: Recursive parent scope resolution to avoid O(n²) parent chain traversals
        if (parentGivenScope === undefined) {
            // Build parent scope recursively to ensure proper inheritance chain
            parentGivenScope = localGetOrCreateNodeScope(state, parentNodeId, undefined, correlationId);
        }

        if (parentGivenScope !== undefined) {
            const xorNode: TXorNode = NodeIdMapUtils.assertXor(state.nodeIdMapCollection, nodeId);

            let shallowCopy: NodeScope;

            if ([Ast.NodeKind.FieldProjection, Ast.NodeKind.FieldSelector].includes(xorNode.node.kind)) {
                shallowCopy = MapUtils.filter(
                    parentGivenScope,
                    (_key: string, value: TScopeItem) => value.kind === ScopeItemKind.Each,
                );
            } else {
                shallowCopy = new Map(parentGivenScope.entries());
            }

            state.givenScope.set(nodeId, shallowCopy);
            trace.exit({ [TraceConstant.Result]: "parent scope resolved recursively" });

            return shallowCopy;
        }
    }

    // The node has no parent or it hasn't been visited.
    const newScope: NodeScope = new Map();
    state.givenScope.set(nodeId, newScope);
    trace.exit({ [TraceConstant.Result]: "set new entry" });

    return newScope;
}

function scopeItemFactoryForKeyValuePairs<
    T extends Extract<TScopeItem, LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem>,
    KVP extends NodeIdMapIterator.TKeyValuePair,
>(
    keyValuePairs: ReadonlyArray<KVP>,
    ancestorKeyNodeId: number,
    getAllowedIdentifiersOptions: IdentifierUtils.GetAllowedIdentifiersOptions,
    scopeItemFactory: (keyValuePair: KVP, isRecursive: boolean) => T,
): ReadonlyArray<[string, T]> {
    const result: [string, T][] = [];

    for (const kvp of keyValuePairs.filter((keyValuePair: KVP) => keyValuePair.value !== undefined)) {
        const isRecursive: boolean = ancestorKeyNodeId === kvp.key.id;

        for (const key of IdentifierUtils.getAllowedIdentifiers(kvp.key.literal, getAllowedIdentifiersOptions)) {
            if (!isRecursive || key.includes("@")) {
                result.push([key, scopeItemFactory(kvp, isRecursive)]);
            }
        }
    }

    return result;
}

function scopeItemFactoryForLetVariable(
    keyValuePair: NodeIdMapIterator.LetKeyValuePair,
    isRecursive: boolean,
): LetVariableScopeItem {
    return {
        kind: ScopeItemKind.LetVariable,
        nodeId: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        value: keyValuePair.value,
    };
}

function scopeItemFactoryForParameter(
    parameter: PseudoFunctionParameterType,
    type: PrimitiveTypeConstant | undefined,
): ParameterScopeItem {
    return {
        kind: ScopeItemKind.Parameter,
        nodeId: parameter.id,
        isRecursive: false,
        name: parameter.name,
        isOptional: parameter.isOptional,
        isNullable: parameter.isNullable,
        type,
    };
}

function scopeItemFactoryForRecordMember(
    keyValuePair: NodeIdMapIterator.RecordKeyValuePair,
    isRecursive: boolean,
): RecordFieldScopeItem {
    return {
        kind: ScopeItemKind.RecordField,
        nodeId: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        value: keyValuePair.value,
    };
}

function scopeItemFactoryForSectionMember(
    keyValuePair: NodeIdMapIterator.SectionKeyValuePair,
    isRecursive: boolean,
): SectionMemberScopeItem {
    return {
        kind: ScopeItemKind.SectionMember,
        nodeId: keyValuePair.source.node.id,
        isRecursive,
        key: keyValuePair.key,
        value: keyValuePair.value,
    };
}
