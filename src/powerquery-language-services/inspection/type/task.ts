// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { MapUtils, ResultUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { assertGetOrCreateNodeScope, getOrCreateScopeItemType, InspectTypeState, inspectXor } from "./inspectType";
import { InspectionSettings, InspectionTraceConstant } from "../..";
import { NodeScope, ScopeTypeByKey } from "../scope";
import { TypeCache, TypeCacheUtils } from "../typeCache";

export type TriedScopeType = PQP.Result<ScopeTypeByKey, PQP.CommonError.CommonError>;

export type TriedType = PQP.Result<Type.TPowerQueryType, PQP.CommonError.CommonError>;

// eslint-disable-next-line require-await
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

    const state: InspectTypeState = createState(settings, nodeIdMapCollection, typeCache, trace.id);

    const result: Promise<TriedScopeType> = ResultUtils.ensureResultAsync(
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

    const state: InspectTypeState = createState(settings, nodeIdMapCollection, typeCache, trace.id);

    const result: TriedType = await ResultUtils.ensureResultAsync(
        () => inspectXor(state, NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId), trace.id),
        settings.locale,
    );

    trace.exit({ [TraceConstant.IsError]: result.kind });

    return result;
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

    for (const scopeItem of nodeScope.values()) {
        if (!state.typeById.has(scopeItem.id)) {
            // eslint-disable-next-line no-await-in-loop
            state.typeById.set(scopeItem.id, await getOrCreateScopeItemType(state, scopeItem));
        }
    }

    const result: ScopeTypeByKey = new Map();

    for (const [key, scopeItem] of nodeScope.entries()) {
        const type: Type.TPowerQueryType = MapUtils.assertGet(
            state.typeById,
            scopeItem.id,
            `expected nodeId to be in givenTypeById`,
            { nodeId: scopeItem.id },
        );

        result.set(key, type);
    }

    trace.exit();

    return result;
}

function createState(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: TypeCache,
    correlationId: number,
): InspectTypeState {
    return {
        library: settings.library,
        locale: settings.locale,
        isWorkspaceCacheAllowed: settings.isWorkspaceCacheAllowed,
        cancellationToken: settings.cancellationToken,
        eachScopeById: settings.eachScopeById,
        initialCorrelationId: correlationId,
        traceManager: settings.traceManager,
        typeStrategy: settings.typeStrategy,
        typeById: typeCache.typeById,
        nodeIdMapCollection,
        scopeById: typeCache.scopeById,
    };
}
