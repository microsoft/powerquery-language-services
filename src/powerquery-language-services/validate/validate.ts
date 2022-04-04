// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic } from "vscode-languageserver-types";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { TextDocument } from "vscode-languageserver-textdocument";

import { TypeCache, TypeCacheUtils } from "../inspection";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateLexAndParse } from "./validateLexAndParse";
import { validateUnknownIdentifiers } from "./validateUnknownIdentifiers";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";
import { WorkspaceCacheUtils } from "../workspaceCache";

export async function validate(
    textDocument: TextDocument,
    validationSettings: ValidationSettings,
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
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
    let unknownIdentifiersDiagnostics: Diagnostic[];

    const maybeNodeIdMapCollection: NodeIdMap.Collection | undefined =
        PQP.TaskUtils.isParseStageOk(maybeTriedParse) || PQP.TaskUtils.isParseStageParseError(maybeTriedParse)
            ? maybeTriedParse.nodeIdMapCollection
            : undefined;

    if (validationSettings.checkInvokeExpressions && maybeNodeIdMapCollection) {
        functionExpressionDiagnostics = validateFunctionExpression(validationSettings, maybeNodeIdMapCollection);

        invokeExpressionDiagnostics = await validateInvokeExpression(
            validationSettings,
            maybeNodeIdMapCollection,
            WorkspaceCacheUtils.getTypeCache(textDocument),
        );
    } else {
        functionExpressionDiagnostics = [];
        invokeExpressionDiagnostics = [];
    }

    if (validationSettings.checkUnknownIdentifiers && maybeNodeIdMapCollection) {
        unknownIdentifiersDiagnostics = await validateUnknownIdentifiers(
            validationSettings,
            maybeNodeIdMapCollection,
            typeCache,
        );
    } else {
        unknownIdentifiersDiagnostics = [];
    }

    return {
        diagnostics: [
            ...(await validateDuplicateIdentifiers(textDocument, validationSettings)),
            ...(await validateLexAndParse(textDocument, validationSettings)),
            ...functionExpressionDiagnostics,
            ...invokeExpressionDiagnostics,
            ...unknownIdentifiersDiagnostics,
        ],
        hasSyntaxError:
            PQP.TaskUtils.isLexStageError(maybeTriedParse) || PQP.TaskUtils.isParseStageError(maybeTriedParse),
    };
}
