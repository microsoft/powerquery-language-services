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
            throw new PQP.CommonError.InvariantError(`expected ancestry to have at least one node`, { nodeId });
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
    readonly scopeById: ScopeById;
    readonly ancestry: ReadonlyArray<TXorNode>;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly eachScopeById: TypeById | undefined;
    readonly cancellationToken: ICancellationToken | undefined;
    ancestryIndex: number;
}

// The only function that should directly mutate `ScopeInspectionState.scopeById`.
// It attempts to reuse the inherited scope instance whenever:
//  1. there's no `newEntries`,
//  2. the node is not a FieldSelector or FieldProjection (which have special scoping rules)
//
// For scenario (1) we take a shallow copy of the parent's scope, then merge in the new entries.
// This means the `newEntries` take precedence over the inherited scope.
//
// For scenario (2) we only inherit `EachScopeItem`s from the parent scope.
function assignScopeForNodeId(
    state: ScopeInspectionState,
    nodeId: number,
    inheritedScope: NodeScope | undefined,
    newEntries: ReadonlyArray<[string, TScopeItem]> | undefined,
    correlationId: number,
): NodeScope {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        assignScopeForNodeId.name,
        correlationId,
        { nodeId },
    );

    // If a scope has already been generated for this nodeId, return it.
    // This can happen as a parent might have assigned a scope to its child already,
    // e.g. LetExpression assigns scope to its expression.
    const existingNodeScope: NodeScope | undefined = state.scopeById.get(nodeId);

    if (existingNodeScope !== undefined) {
        trace.exit({ [TraceConstant.Result]: "cache hit" });

        return existingNodeScope;
    }

    // Unique case for root node.
    if (inheritedScope === undefined) {
        const nodeScope: NodeScope = {
            createdForNodeId: nodeId,
            scopeItemByKey: new Map(newEntries ?? []),
        };

        state.scopeById.set(nodeId, nodeScope);
        trace.exit({ [TraceConstant.Result]: "new root scope" });

        return nodeScope;
    }

    const xorNode: TXorNode = NodeIdMapUtils.assertXor(state.nodeIdMapCollection, nodeId);

    // We can't actually inherit everything if node is a FieldSelector or FieldProjection,
    // so we create a new scope that only includes allowed items.
    if ([Ast.NodeKind.FieldProjection, Ast.NodeKind.FieldSelector].includes(xorNode.node.kind)) {
        const inheritedEachScopeItemEntries: ReadonlyArray<[string, TScopeItem]> = [
            ...inheritedScope.scopeItemByKey.entries(),
        ].filter(([_key, scopeItem]: [string, Inspection.TScopeItem]) => scopeItem.kind === ScopeItemKind.Each);

        const nodeScope: NodeScope = {
            createdForNodeId: nodeId,
            scopeItemByKey: new Map([...inheritedEachScopeItemEntries, ...(newEntries ?? [])]),
        };

        state.scopeById.set(nodeId, nodeScope);
        trace.exit({ [TraceConstant.Result]: "inherited filtered scope" });

        return nodeScope;
    }
    // Else if there are no new entries we can simply inherit the scope.
    else if (!newEntries) {
        state.scopeById.set(nodeId, inheritedScope);
        trace.exit({ [TraceConstant.Result]: "inherited scope" });

        return inheritedScope;
    }
    // Else there are new entries so we create a new scope that merges the inherited scope with the new entries.
    else {
        const nodeScope: NodeScope = {
            createdForNodeId: nodeId,
            scopeItemByKey: new Map([...inheritedScope.scopeItemByKey.entries(), ...newEntries]),
        };

        state.scopeById.set(nodeId, nodeScope);
        trace.exit({ [TraceConstant.Result]: "created new scope" });

        return nodeScope;
    }
}

function getParentScope(state: ScopeInspectionState, nodeId: number): NodeScope | undefined {
    const parentNodeId: number | undefined = state.nodeIdMapCollection.parentIdById.get(nodeId);

    if (parentNodeId === undefined) {
        return undefined;
    }

    return state.scopeById.get(parentNodeId);
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
        scopeById,
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
            assignScopeForNodeId(
                state,
                xorNode.node.id,
                getParentScope(state, xorNode.node.id),
                /* newEntries */ undefined,
                trace.id,
            );
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

    // Generate the scope for the EachExpression
    const nodeScope: NodeScope = assignScopeForNodeId(
        state,
        eachExpr.node.id,
        getParentScope(state, eachExpr.node.id),
        /* newEntries */ undefined,
        trace.id,
    );

    // Propegate the scope to the paired expression (if one exists)
    const expression: TXorNode | undefined = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, eachExpr.node.id, 1);

    if (expression !== undefined) {
        assignScopeForNodeId(
            state,
            expression.node.id,
            nodeScope,
            // Append the implicit "_" parameter for the 'each' expression.
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
            trace.id,
        );
    }

    trace.exit();
}

function inspectFunctionExpression(state: ScopeInspectionState, fnExpr: TXorNode, correlationId: number): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectFunctionExpression.name,
        correlationId,
    );

    XorNodeUtils.assertIsNodeKind<Ast.FunctionExpression>(fnExpr, Ast.NodeKind.FunctionExpression);

    // Creates the NodeScope for the FunctionExpression.
    const nodeScope: NodeScope = assignScopeForNodeId(
        state,
        fnExpr.node.id,
        getParentScope(state, fnExpr.node.id),
        /* newEntries */ undefined,
        trace.id,
    );

    // Build up a list of new scope items derived from the function's parameters.
    const newEntries: [string, ParameterScopeItem][] = [];
    const pseudoType: PseduoFunctionExpressionType = pseudoFunctionExpressionType(state.nodeIdMapCollection, fnExpr);

    for (const parameter of pseudoType.parameters) {
        const type: PrimitiveTypeConstant | undefined = parameter.type
            ? TypeUtils.primitiveTypeConstantKindFromTypeKind(parameter.type)
            : undefined;

        const parameterScopeItem: ParameterScopeItem = scopeItemFactoryForParameter(parameter, type);

        for (const scopeKey of IdentifierUtils.getAllowedIdentifiers(parameter.name.literal)) {
            newEntries.push([scopeKey, parameterScopeItem]);
        }
    }

    // Propagate the FunctionExpression's scope to its body.
    const functionExpressionBody: TXorNode | undefined = NodeIdMapUtils.nthChildXor(
        state.nodeIdMapCollection,
        fnExpr.node.id,
        3,
    );

    if (functionExpressionBody !== undefined) {
        assignScopeForNodeId(state, functionExpressionBody.node.id, nodeScope, newEntries, trace.id);
    }

    trace.exit();
}

function inspectLetExpression(state: ScopeInspectionState, letExpr: TXorNode, correlationId: number): void {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScope,
        inspectLetExpression.name,
        correlationId,
    );

    XorNodeUtils.assertIsNodeKind<Ast.LetExpression>(letExpr, Ast.NodeKind.LetExpression);

    // Creates the NodeScope for the LetExpression.
    const nodeScope: NodeScope = assignScopeForNodeId(
        state,
        letExpr.node.id,
        getParentScope(state, letExpr.node.id),
        /* newEntries */ undefined,
        trace.id,
    );

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

    const expression: TXorNode | undefined = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, letExpr.node.id, 3);

    if (expression !== undefined) {
        assignScopeForNodeId(state, expression.node.id, nodeScope, newEntries, trace.id);
    }

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

    // Creates the NodeScope for the record.
    const nodeScope: NodeScope = assignScopeForNodeId(
        state,
        record.node.id,
        getParentScope(state, record.node.id),
        /* newEntries */ undefined,
        trace.id,
    );

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

        assignScopeForNodeId(
            state,
            kvp.value.node.id,
            getParentScope(state, kvp.value.node.id),
            scopeItemFactoryForKeyValuePairs(
                keyValuePairs,
                kvp.key.id,
                { allowRecursive: true },
                scopeItemFactoryForSectionMember,
            ),
            trace.id,
        );
    }

    trace.exit();
}

// Expands the scope on the value part of the key value pair.
function inspectKeyValuePairs<
    T extends Extract<TScopeItem, LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem>,
    KVP extends NodeIdMapIterator.TKeyValuePair,
>(
    state: ScopeInspectionState,
    inheritedScope: NodeScope | undefined,
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

        assignScopeForNodeId(
            state,
            kvp.value.node.id,
            inheritedScope,
            scopeItemFactoryForKeyValuePairs(keyValuePairs, kvp.key.id, getAllowedIdentifiersOptions, scopeItemFactory),
            trace.id,
        );
    }

    trace.exit();
}

function scopeItemFactoryForKeyValuePairs<
    T extends Extract<TScopeItem, LetVariableScopeItem | RecordFieldScopeItem | SectionMemberScopeItem>,
    KVP extends NodeIdMapIterator.TKeyValuePair,
>(
    keyValuePairs: ReadonlyArray<KVP>,
    keyNodeId: number,
    getAllowedIdentifiersOptions: IdentifierUtils.GetAllowedIdentifiersOptions,
    scopeItemFactory: (keyValuePair: KVP, isRecursive: boolean) => T,
): ReadonlyArray<[string, T]> {
    const result: [string, T][] = [];

    for (const kvp of keyValuePairs.filter((keyValuePair: KVP) => keyValuePair.value !== undefined)) {
        const isRecursive: boolean = keyNodeId === kvp.key.id;

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
