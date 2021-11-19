// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver-types";

import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";

export function validate(textDocument: TextDocument, validationSettings: ValidationSettings): ValidationResult {
    const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
        textDocument,
        validationSettings,
    );

    let invokeExpressionDiagnostics: Diagnostic[];
    if (
        validationSettings.checkInvokeExpressions &&
        (PQP.TaskUtils.isParseStageOk(cacheItem) || PQP.TaskUtils.isParseStageParseError(cacheItem))
    ) {
        invokeExpressionDiagnostics = validateInvokeExpression(
            validationSettings,
            cacheItem.nodeIdMapCollection,
            WorkspaceCacheUtils.getOrCreateTypeCache(textDocument),
        );
    } else {
        invokeExpressionDiagnostics = [];
    }

    return {
        diagnostics: [
            ...validateDuplicateIdentifiers(textDocument, validationSettings),
            ...validateLexAndParse(textDocument, validationSettings),
            ...invokeExpressionDiagnostics,
        ],
        hasSyntaxError: PQP.TaskUtils.isLexStageError(cacheItem) || PQP.TaskUtils.isParseStageError(cacheItem),
    };
}
