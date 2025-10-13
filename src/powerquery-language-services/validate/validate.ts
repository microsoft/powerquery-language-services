// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    type NodeIdMap,
    type ParseError,
    type ParseState,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Diagnostic } from "vscode-languageserver-types";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { type Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { type Analysis, type AnalysisSettings, AnalysisUtils } from "../analysis";
import { type CommonError, type Result, ResultUtils } from "@microsoft/powerquery-parser";
import { type TypeCache } from "../inspection";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
import { validateInvokeExpression } from "./validateInvokeExpression";
import { type ValidateOk } from "./validateOk";
import { validateParse } from "./validateParse";
import { validateUnknownIdentifiers } from "./validateUnknownIdentifiers";
import { type ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

export function validate(
    textDocument: TextDocument,
    analysisSettings: AnalysisSettings,
    validationSettings: ValidationSettings,
): Promise<Result<ValidateOk | undefined, CommonError.CommonError>> {
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

        const analysis: Analysis = AnalysisUtils.analysis(textDocument, analysisSettings);
        const parseState: ParseState | undefined = ResultUtils.assertOk(await analysis.getParseState());
        const parseError: ParseError.ParseError | undefined = ResultUtils.assertOk(await analysis.getParseError());

        if (parseState === undefined) {
            trace.exit();

            return undefined;
        }

        // If we have a parse error and checkDiagnosticsOnParseError is false,
        // only return parse error diagnostics without checking other validations
        if (parseError !== undefined && !validationSettings.checkDiagnosticsOnParseError) {
            const result: ValidateOk = {
                diagnostics: await validateParse(parseError, updatedSettings),
                hasSyntaxError: true,
            };

            trace.exit();

            return result;
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

        const result: ValidateOk = {
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
            hasSyntaxError: parseError !== undefined,
        };

        trace.exit();

        return result;
    }, validationSettings.locale);
}
