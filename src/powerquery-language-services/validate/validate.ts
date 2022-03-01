// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";

import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";
import { WorkspaceCacheUtils } from "../workspaceCache";

export async function validate(
    textDocument: TextDocument,
    validationSettings: ValidationSettings,
): Promise<ValidationResult> {
    const parsePromise: PQP.Task.TriedLexTask | PQP.Task.TriedParseTask =
        await WorkspaceCacheUtils.getOrCreateParsePromise(textDocument, validationSettings);

    let invokeExpressionDiagnostics: Diagnostic[];

    if (
        validationSettings.checkInvokeExpressions &&
        (PQP.TaskUtils.isParseStageOk(parsePromise) || PQP.TaskUtils.isParseStageParseError(parsePromise))
    ) {
        invokeExpressionDiagnostics = await validateInvokeExpression(
            validationSettings,
            parsePromise.nodeIdMapCollection,
            WorkspaceCacheUtils.getTypeCache(textDocument),
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
        hasSyntaxError: PQP.TaskUtils.isLexStageError(parsePromise) || PQP.TaskUtils.isParseStageError(parsePromise),
    };
}
