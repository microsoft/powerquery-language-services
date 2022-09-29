// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, ParseError, ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Diagnostic } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { Analysis, AnalysisSettings, AnalysisUtils } from "../analysis";
import { CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { TypeCache } from "../inspection";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { validateParse } from "./validateParse";
import { validateUnknownIdentifiers } from "./validateUnknownIdentifiers";
import type { ValidationOk } from "./validationOk";
import type { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

export function validate(
    textDocument: TextDocument,
    analysisSettings: AnalysisSettings,
    validationSettings: ValidationSettings,
): Promise<Result<ValidationOk | undefined, CommonError.CommonError>> {
    return ResultUtils.ensureResultAsync(async () => {
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

            return undefined;
        }

        let functionExpressionDiagnostics: Diagnostic[];
        let invokeExpressionDiagnostics: Diagnostic[];
        let unknownIdentifiersDiagnostics: Diagnostic[];

        const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
        const typeCache: TypeCache = analysis.getTypeCache();

        if (validationSettings.checkInvokeExpressions && nodeIdMapCollection) {
            functionExpressionDiagnostics = validateFunctionExpression(validationSettings, nodeIdMapCollection);

            invokeExpressionDiagnostics = await validateInvokeExpression(
                validationSettings,
                nodeIdMapCollection,
                typeCache,
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
            );
        } else {
            unknownIdentifiersDiagnostics = [];
        }

        const result: ValidationOk = {
            diagnostics: [
                ...validateDuplicateIdentifiers(
                    textDocument,
                    nodeIdMapCollection,
                    updatedSettings,
                    validationSettings.cancellationToken,
                ),
                ...(await validateParse(parseError, updatedSettings)),
                ...functionExpressionDiagnostics,
                ...invokeExpressionDiagnostics,
                ...unknownIdentifiersDiagnostics,
            ],
            hasSyntaxError: Boolean(await analysis.getParseError()),
        };

        trace.exit();

        return result;
    }, validationSettings.locale);
}
