// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";

import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";

export async function validate(
    textDocument: TextDocument,
    validationSettings: ValidationSettings,
): Promise<ValidationResult> {
    const cacheItem: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
        textDocument,
        validationSettings,
    );

    let invokeExpressionDiagnostics: Diagnostic[];

    if (
        validationSettings.checkInvokeExpressions &&
        (PQP.TaskUtils.isParseStageOk(cacheItem) || PQP.TaskUtils.isParseStageParseError(cacheItem))
    ) {
        invokeExpressionDiagnostics = await validateInvokeExpression(
            validationSettings,
            cacheItem.nodeIdMapCollection,
            WorkspaceCacheUtils.getOrCreateTypeCache(textDocument),
        );
    } else {
        invokeExpressionDiagnostics = [];
    }

    return {
        diagnostics: [
            ...(await validateDuplicateIdentifiers(textDocument, validationSettings)),
            ...(await validateLexAndParse(textDocument, validationSettings)),
            ...invokeExpressionDiagnostics,
        ],
        hasSyntaxError: PQP.TaskUtils.isLexStageError(cacheItem) || PQP.TaskUtils.isParseStageError(cacheItem),
    };
}
