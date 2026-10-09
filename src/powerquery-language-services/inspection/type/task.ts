// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { assertGetOrCreateNodeScope, getOrCreateScopeItemType, inspectXor } from "./inspectType";
import { InspectionSettings, InspectionTraceConstant } from "../..";
import { InspectTypeState, InspectTypeStateUtils } from "./inspectType/inspectTypeState";
import { NodeScope, ScopeTypeByKey, TScopeItem } from "../scope";
import { TypeCache, TypeCacheUtils } from "../typeCache";

export type TriedScopeType = PQP.Result<ScopeTypeByKey, PQP.CommonError.CommonError>;

export type TriedType = PQP.Result<Type.TPowerQueryType, PQP.CommonError.CommonError>;

// Keep unfinished requests out of the public TypeCache shape so existing cache implementations remain compatible.
// Only identical roots share work; merging different roots would need dependency tracking for mutual-recursion cycles.
const triedTypeTaskByCache: WeakMap<TypeCache, Map<number, Promise<TriedType>>> = new WeakMap();

export async function tryScopeType(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.emptyCache(),
): Promise<TriedScopeType> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectScopeType,
        tryScopeType.name,
        settings.initialCorrelationId,
    );

    const state: InspectTypeState = InspectTypeStateUtils.fromInspectionSettings(
        settings,
        nodeIdMapCollection,
        typeCache,
        trace.id,
    );

    const result: TriedScopeType = await ResultUtils.ensureResultAsync(
        () => inspectScopeType(state, nodeId, trace.id),
        settings.locale,
    );

    trace.exit();

    return result;
}

export async function tryType(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.emptyCache(),
): Promise<TriedType> {
    const trace: Trace = settings.traceManager.entry(
        InspectionTraceConstant.InspectType,
        tryType.name,
        settings.initialCorrelationId,
    );

    settings.cancellationToken?.throwIfCancelled();

    let triedTypeTaskById: Map<number, Promise<TriedType>> | undefined = triedTypeTaskByCache.get(typeCache);

    if (triedTypeTaskById === undefined) {
        triedTypeTaskById = new Map();
        triedTypeTaskByCache.set(typeCache, triedTypeTaskById);
    }

    let resultTask: Promise<TriedType> | undefined = triedTypeTaskById.get(nodeId);
    const ownsResultTask: boolean = resultTask === undefined;

    if (resultTask === undefined) {
        resultTask = ResultUtils.ensureResultAsync(
            () =>
                inspectXor(
                    InspectTypeStateUtils.fromInspectionSettings(settings, nodeIdMapCollection, typeCache, trace.id),
                    NodeIdMapUtils.assertXor(nodeIdMapCollection, nodeId),
                    trace.id,
                ),
            settings.locale,
        );

        triedTypeTaskById.set(nodeId, resultTask);
    }

    try {
        const result: TriedType = await resultTask;
        trace.exit({ [TraceConstant.IsError]: result.kind, cacheHit: !ownsResultTask });

        return result;
    } finally {
        // Keep only completed values in typeById. A rejected, cancelled or failed request must be retryable.
        if (ownsResultTask && triedTypeTaskById.get(nodeId) === resultTask) {
            triedTypeTaskById.delete(nodeId);
        }
    }
}

async function inspectScopeType(
    state: InspectTypeState,
    nodeId: number,
    correlationId: number,
): Promise<ScopeTypeByKey> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectScopeType,
        inspectScopeType.name,
        correlationId,
    );

    const nodeScope: NodeScope = await assertGetOrCreateNodeScope(state, nodeId, trace.id);

    // Resolve types on-demand instead of eagerly.
    // The resolver closure captures the state, preserving the typeById cache side-effect.
    const result: ScopeTypeByKey = new ScopeTypeByKey(
        nodeScope,
        async (scopeItem: TScopeItem): Promise<Type.TPowerQueryType> => {
            if (!state.typeById.has(scopeItem.nodeId)) {
                state.typeById.set(scopeItem.nodeId, await getOrCreateScopeItemType(state, scopeItem));
            }

            return state.typeById.get(scopeItem.nodeId)!;
        },
    );

    trace.exit();

    return result;
}
