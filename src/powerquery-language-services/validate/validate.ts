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
    const maybeTriedParse: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
        textDocument,
        validationSettings,
    );

    if (maybeTriedParse === undefined) {
        return {
            diagnostics: [],
            hasSyntaxError: false,
        };
    }

    let invokeExpressionDiagnostics: Diagnostic[];

    if (
        validationSettings.checkInvokeExpressions &&
        (PQP.TaskUtils.isParseStageOk(maybeTriedParse) || PQP.TaskUtils.isParseStageParseError(maybeTriedParse))
    ) {
        invokeExpressionDiagnostics = await validateInvokeExpression(
            validationSettings,
            maybeTriedParse.nodeIdMapCollection,
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
        hasSyntaxError:
            PQP.TaskUtils.isLexStageError(maybeTriedParse) || PQP.TaskUtils.isParseStageError(maybeTriedParse),
    };
}
