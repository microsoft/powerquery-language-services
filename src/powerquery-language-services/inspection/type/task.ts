// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { assertGetOrCreateNodeScope, getOrCreateScopeItemType, InspectTypeState, inspectXor } from "./inspectType";
import { TypeCache, TypeCacheUtils } from "../typeCache";
import { InspectionSettings } from "../..";
import { NodeScope } from "../scope";
import { ScopeTypeByKey } from "../scope";

export type TriedScopeType = PQP.Result<ScopeTypeByKey, PQP.CommonError.CommonError>;

export type TriedType = PQP.Result<Type.TPowerQueryType, PQP.CommonError.CommonError>;

export function tryScopeType(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    // If a TypeCache is given, then potentially add to its values and include it as part of the return,
    // Else create a new TypeCache and include it in the return.
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): TriedScopeType {
    const state: InspectTypeState = {
        settings,
        givenTypeById: typeCache.typeById,
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        scopeById: typeCache.scopeById,
    };

    return ResultUtils.ensureResult(settings.locale, () => inspectScopeType(state, nodeId));
}

export function tryType(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): TriedType {
    const state: InspectTypeState = {
        settings,
        givenTypeById: typeCache.typeById,
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        scopeById: typeCache.scopeById,
    };

    return ResultUtils.ensureResult(settings.locale, () =>
        inspectXor(state, NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId)),
    );
}

function inspectScopeType(state: InspectTypeState, nodeId: number): ScopeTypeByKey {
    const nodeScope: NodeScope = assertGetOrCreateNodeScope(state, nodeId);

    for (const scopeItem of nodeScope.values()) {
        if (!state.givenTypeById.has(scopeItem.id)) {
            state.deltaTypeById.set(scopeItem.id, getOrCreateScopeItemType(state, scopeItem));
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
