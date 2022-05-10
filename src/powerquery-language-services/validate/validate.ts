// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic } from "vscode-languageserver-types";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateLexAndParse } from "./validateLexAndParse";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";
import { WorkspaceCacheUtils } from "../workspaceCache";

export async function validate(
    textDocument: TextDocument,
    validationSettings: ValidationSettings,
): Promise<ValidationResult> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validate.name,
        validationSettings.maybeInitialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        maybeInitialCorrelationId: trace.id,
    };

    const maybeTriedParse: PQP.Task.TriedParseTask | undefined = await WorkspaceCacheUtils.getOrCreateParsePromise(
        textDocument,
        updatedSettings,
        updatedSettings.isWorkspaceCacheEnabled,
    );

    if (maybeTriedParse === undefined) {
        trace.exit();

        return {
            diagnostics: [],
            hasSyntaxError: false,
        };
    }

    let functionExpressionDiagnostics: Diagnostic[];
    let invokeExpressionDiagnostics: Diagnostic[];

    if (
        updatedSettings.checkInvokeExpressions &&
        (PQP.TaskUtils.isParseStageOk(maybeTriedParse) || PQP.TaskUtils.isParseStageParseError(maybeTriedParse))
    ) {
        const nodeIdMapCollection: NodeIdMap.Collection = maybeTriedParse.nodeIdMapCollection;

        functionExpressionDiagnostics = validateFunctionExpression(updatedSettings, nodeIdMapCollection);

        invokeExpressionDiagnostics = await validateInvokeExpression(
            updatedSettings,
            nodeIdMapCollection,
            WorkspaceCacheUtils.getTypeCache(textDocument, validationSettings.isWorkspaceCacheEnabled),
        );
    } else {
        functionExpressionDiagnostics = [];
        invokeExpressionDiagnostics = [];
    }

    const result: ValidationResult = {
        diagnostics: [
            ...(await validateDuplicateIdentifiers(textDocument, updatedSettings)),
            ...(await validateLexAndParse(textDocument, updatedSettings)),
            ...functionExpressionDiagnostics,
            ...invokeExpressionDiagnostics,
        ],
        hasSyntaxError:
            PQP.TaskUtils.isLexStageError(maybeTriedParse) || PQP.TaskUtils.isParseStageError(maybeTriedParse),
    };

    trace.exit();

    return result;
}
