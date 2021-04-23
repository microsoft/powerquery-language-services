// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticRelatedInformation, DocumentUri } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

import * as LanguageServiceUtils from "../languageServiceUtils";

import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { Localization, LocalizationUtils } from "../localization";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { Inspection, InspectionUtils } from "..";
import { ValidationSettings } from "./validationSettings";

export function validateDuplicateIdentifiers(
    document: TextDocument,
    validationOptions: ValidationSettings,
): ReadonlyArray<Diagnostic> {
    if (!validationOptions.checkForDuplicateIdentifiers) {
        return [];
    }

    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(
        document,
        validationOptions?.locale,
    );

    let maybeNodeIdMapCollection: PQP.Parser.NodeIdMap.Collection | undefined;
    if (PQP.TaskUtils.isParseStageOk(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    } else if (PQP.TaskUtils.isParseStageParseError(cacheItem)) {
        maybeNodeIdMapCollection = cacheItem.nodeIdMapCollection;
    }

    if (maybeNodeIdMapCollection === undefined) {
        return [];
    }

    InspectionUtils.createInspectionSettings();
    Inspection.tryInvokeExpression(settings);

    const documentUri: string = document.uri;
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = maybeNodeIdMapCollection;

    return [
        ...validateDuplicateIdentifiersForLetExpresion(documentUri, nodeIdMapCollection, validationOptions),
        ...validateDuplicateIdentifiersForRecord(documentUri, nodeIdMapCollection, validationOptions),
        ...validateDuplicateIdentifiersForSection(documentUri, nodeIdMapCollection, validationOptions),
    ];
}
