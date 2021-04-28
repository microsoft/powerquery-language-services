// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { NodeScope } from "../scope";
import { ScopeTypeByKey } from "../scope";
import { InspectionSettings } from "../settings";
import { TypeCache } from "../typeCache";
import { assertGetOrCreateNodeScope, getOrCreateScopeItemType, InspectTypeState, inspectXor } from "./inspectType";

export type TriedScopeType = PQP.Result<ScopeTypeByKey, PQP.CommonError.CommonError>;

export type TriedType = PQP.Result<PQP.Language.Type.TPowerQueryType, PQP.CommonError.CommonError>;

export function tryScopeType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    nodeId: number,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedScopeType {
    const state: InspectTypeState<S> = {
        settings,
        givenTypeById: maybeTypeCache?.typeById ?? new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        scopeById: maybeTypeCache?.scopeById ?? new Map(),
    };

    return PQP.ResultUtils.ensureResult(settings.locale, () => inspectScopeType(state, nodeId));
}

export function tryType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    nodeId: number,
    maybeTypeCache: TypeCache | undefined = undefined,
): TriedType {
    const state: InspectTypeState<S> = {
        settings,
        givenTypeById: maybeTypeCache?.typeById ?? new Map(),
        deltaTypeById: new Map(),
        nodeIdMapCollection,
        scopeById: maybeTypeCache?.scopeById ?? new Map(),
    };

    return PQP.ResultUtils.ensureResult(settings.locale, () =>
        inspectXor(state, PQP.Parser.NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId)),
    );
}

function inspectScopeType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    nodeId: number,
): ScopeTypeByKey {
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
        const type: PQP.Language.Type.TPowerQueryType = Assert.asDefined(
            state.givenTypeById.get(scopeItem.id),
            `expected nodeId to be in givenTypeById`,
            { nodeId: scopeItem.id },
        );
        result.set(key, type);
    }

    return result;
}
