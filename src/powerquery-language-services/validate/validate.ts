// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic } from "vscode-languageserver-types";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { TextDocument } from "vscode-languageserver-textdocument";

import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
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

    let functionExpressionDiagnostics: Diagnostic[];
    let invokeExpressionDiagnostics: Diagnostic[];

    if (
        validationSettings.checkInvokeExpressions &&
        (PQP.TaskUtils.isParseStageOk(maybeTriedParse) || PQP.TaskUtils.isParseStageParseError(maybeTriedParse))
    ) {
        const nodeIdMapCollection: NodeIdMap.Collection = maybeTriedParse.nodeIdMapCollection;

        functionExpressionDiagnostics = validateFunctionExpression(validationSettings, nodeIdMapCollection);

        invokeExpressionDiagnostics = await validateInvokeExpression(
            validationSettings,
            nodeIdMapCollection,
            WorkspaceCacheUtils.getTypeCache(textDocument),
        );
    } else {
        functionExpressionDiagnostics = [];
        invokeExpressionDiagnostics = [];
    }

    return {
        diagnostics: [
            ...(await validateDuplicateIdentifiers(textDocument, validationSettings)),
            ...(await validateLexAndParse(textDocument, validationSettings)),
            ...functionExpressionDiagnostics,
            ...invokeExpressionDiagnostics,
        ],
        hasSyntaxError:
            PQP.TaskUtils.isLexStageError(maybeTriedParse) || PQP.TaskUtils.isParseStageError(maybeTriedParse),
    };
}
