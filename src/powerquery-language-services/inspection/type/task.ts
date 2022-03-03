// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { assertGetOrCreateNodeScope, getOrCreateScopeItemType, InspectTypeState, inspectXor } from "./inspectType";
import { InspectionSettings, LanguageServiceTraceConstant } from "../..";
import { NodeScope, ScopeTypeByKey } from "../scope";
import { TypeCache, TypeCacheUtils } from "../typeCache";

export type TriedScopeType = PQP.Result<ScopeTypeByKey, PQP.CommonError.CommonError>;

export type TriedType = PQP.Result<Type.TPowerQueryType, PQP.CommonError.CommonError>;

export function tryScopeType(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<TriedScopeType> {
    const trace: Trace = settings.traceManager.entry(LanguageServiceTraceConstant.Type, tryScopeType.name);

    const state: InspectTypeState = {
        locale: settings.locale,
        maybeCancellationToken: settings.maybeCancellationToken,
        maybeEachScopeById: settings.maybeEachScopeById,
        maybeExternalTypeResolver: settings.maybeExternalTypeResolver,
        traceManager: settings.traceManager,
        givenTypeById: typeCache.typeById,
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        scopeById: typeCache.scopeById,
    };

    const result: Promise<TriedScopeType> = ResultUtils.ensureResultAsync(settings.locale, () =>
        inspectScopeType(state, nodeId),
    );

    trace.exit();

    return result;
}

export async function tryType(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<TriedType> {
    const trace: Trace = settings.traceManager.entry(LanguageServiceTraceConstant.Type, tryType.name);

    const state: InspectTypeState = {
        locale: settings.locale,
        maybeCancellationToken: settings.maybeCancellationToken,
        maybeEachScopeById: settings.maybeEachScopeById,
        maybeExternalTypeResolver: settings.maybeExternalTypeResolver,
        traceManager: settings.traceManager,
        givenTypeById: typeCache.typeById,
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        scopeById: typeCache.scopeById,
    };

    const result: TriedType = await ResultUtils.ensureResultAsync(settings.locale, () =>
        inspectXor(state, NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId)),
    );

    trace.exit({ [TraceConstant.IsError]: result.kind });

    return result;
}

async function inspectScopeType(state: InspectTypeState, nodeId: number): Promise<ScopeTypeByKey> {
    const nodeScope: NodeScope = await assertGetOrCreateNodeScope(state, nodeId);

    for (const scopeItem of nodeScope.values()) {
        if (!state.givenTypeById.has(scopeItem.id)) {
            // eslint-disable-next-line no-await-in-loop
            state.deltaTypeById.set(scopeItem.id, await getOrCreateScopeItemType(state, scopeItem));
        }
    }

    for (const [key, value] of state.deltaTypeById.entries()) {
        state.givenTypeById.set(key, value);
    }

    const result: ScopeTypeByKey = new Map();

    for (const [key, scopeItem] of nodeScope.entries()) {
        const type: Type.TPowerQueryType = Assert.asDefined(
            state.givenTypeById.get(scopeItem.id),
            `expected nodeId to be in givenTypeById`,
            { nodeId: scopeItem.id },
        );

        result.set(key, type);
    }

    return result;
}
