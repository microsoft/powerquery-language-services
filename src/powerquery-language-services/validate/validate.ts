// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, ParseError, ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Diagnostic } from "vscode-languageserver-types";
import { ICancellationToken } from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { Analysis, AnalysisSettings, AnalysisUtils } from "../analysis";
import { TypeCache } from "../inspection";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateParse } from "./validateParse";
import { validateUnknownIdentifiers } from "./validateUnknownIdentifiers";
import type { ValidationResult } from "./validationResult";
import type { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

export async function validate(
    textDocument: TextDocument,
    analysisSettings: AnalysisSettings,
    validationSettings: ValidationSettings,
    cancellationToken: ICancellationToken,
): Promise<ValidationResult> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validate.name,
        validationSettings.initialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        initialCorrelationId: trace.id,
    };

    const analysis: Analysis = AnalysisUtils.createAnalysis(textDocument, analysisSettings);
    const parseState: ParseState | undefined = await analysis.getParseState();
    const parseError: ParseError.ParseError | undefined = await analysis.getParseError();

    if (parseState === undefined) {
        trace.exit();

        return {
            diagnostics: [],
            hasSyntaxError: false,
        };
    }

    let functionExpressionDiagnostics: Diagnostic[];
    let invokeExpressionDiagnostics: Diagnostic[];
    let unknownIdentifiersDiagnostics: Diagnostic[];

    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const typeCache: TypeCache = analysis.getTypeCache();

    if (validationSettings.checkInvokeExpressions && nodeIdMapCollection) {
        functionExpressionDiagnostics = validateFunctionExpression(
            validationSettings,
            nodeIdMapCollection,
            cancellationToken,
        );

        invokeExpressionDiagnostics = await validateInvokeExpression(
            validationSettings,
            nodeIdMapCollection,
            typeCache,
            cancellationToken,
        );
    } else {
        functionExpressionDiagnostics = [];
        invokeExpressionDiagnostics = [];
    }

    if (validationSettings.checkUnknownIdentifiers && nodeIdMapCollection) {
        unknownIdentifiersDiagnostics = await validateUnknownIdentifiers(
            validationSettings,
            nodeIdMapCollection,
            typeCache,
            cancellationToken,
        );
    } else {
        unknownIdentifiersDiagnostics = [];
    }

    const result: ValidationResult = {
        diagnostics: [
            ...validateDuplicateIdentifiers(textDocument, nodeIdMapCollection, updatedSettings, cancellationToken),
            ...(await validateParse(parseError, updatedSettings)),
            ...functionExpressionDiagnostics,
            ...invokeExpressionDiagnostics,
            ...unknownIdentifiersDiagnostics,
        ],
        hasSyntaxError: Boolean(await analysis.getParseError()),
    };

    trace.exit();

    return result;
}
