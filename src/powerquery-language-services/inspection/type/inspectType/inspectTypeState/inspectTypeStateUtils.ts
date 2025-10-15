// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { type InspectionSettings } from "../../../../inspectionSettings";
import { type InspectTypeState } from "./inspectTypeState";
import { type TypeCache } from "../../../typeCache";

export function toInspectionSettings(inspectTypeState: InspectTypeState, trace: Trace): InspectionSettings {
    return {
        cancellationToken: inspectTypeState.cancellationToken,
        eachScopeById: inspectTypeState.eachScopeById,
        initialCorrelationId: trace.correlationId,
        isWorkspaceCacheAllowed: inspectTypeState.isWorkspaceCacheAllowed,
        library: inspectTypeState.library,
        locale: inspectTypeState.locale,
        parseBehavior: inspectTypeState.parseBehavior,
        parser: inspectTypeState.parser,
        traceManager: inspectTypeState.traceManager,
        typeStrategy: inspectTypeState.typeStrategy,
        newParseState: inspectTypeState.newParseState,
        parserEntryPoint: inspectTypeState.parserEntryPoint,
    };
}

export function fromInspectionSettings(
    inspectionSettings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: TypeCache,
    correlationId: number,
): InspectTypeState {
    return {
        cancellationToken: inspectionSettings.cancellationToken,
        eachScopeById: inspectionSettings.eachScopeById,
        initialCorrelationId: correlationId,
        isWorkspaceCacheAllowed: inspectionSettings.isWorkspaceCacheAllowed,
        library: inspectionSettings.library,
        locale: inspectionSettings.locale,
        nodeIdMapCollection,
        parseBehavior: inspectionSettings.parseBehavior,
        parser: inspectionSettings.parser,
        scopeById: typeCache.scopeById,
        traceManager: inspectionSettings.traceManager,
        typeById: typeCache.typeById,
        typeStrategy: inspectionSettings.typeStrategy,
        newParseState: inspectionSettings.newParseState,
        parserEntryPoint: inspectionSettings.parserEntryPoint,
    };
}
