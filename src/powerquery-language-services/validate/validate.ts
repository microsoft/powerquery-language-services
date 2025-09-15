// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { NodeIdMap, ParseError, ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Diagnostic } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import * as PromiseUtils from "../promiseUtils";

import { Analysis, AnalysisSettings, AnalysisUtils } from "../analysis";
import { TypeCache } from "../inspection";
import { validateDuplicateIdentifiers } from "./validateDuplicateIdentifiers";
import { validateFunctionExpression } from "./validateFunctionExpression";
import { validateInvokeExpression } from "./validateInvokeExpression";
import type { ValidateOk } from "./validateOk";
import { validateParse } from "./validateParse";
import { validateUnknownIdentifiers } from "./validateUnknownIdentifiers";
import type { ValidationSettings } from "./validationSettings";
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

        validationSettings.cancellationToken?.throwIfCancelled();

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

        const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
        const typeCache: TypeCache = analysis.getTypeCache();

        // Define validation operations to run sequentially
        const validationOperations: (() => Promise<Diagnostic[]>)[] = [
            // Parse validation (if there are parse errors)
            async (): Promise<Diagnostic[]> => await validateParse(parseError, updatedSettings),
        ];

        // Add conditional validations based on settings
        if (validationSettings.checkForDuplicateIdentifiers && nodeIdMapCollection) {
            validationOperations.push(
                async (): Promise<Diagnostic[]> =>
                    await validateDuplicateIdentifiers(
                        textDocument,
                        nodeIdMapCollection,
                        updatedSettings,
                        validationSettings.cancellationToken,
                    ),
            );
        }

        if (validationSettings.checkInvokeExpressions && nodeIdMapCollection) {
            validationOperations.push(
                async (): Promise<Diagnostic[]> =>
                    await validateFunctionExpression(validationSettings, nodeIdMapCollection),
                async (): Promise<Diagnostic[]> =>
                    await validateInvokeExpression(validationSettings, nodeIdMapCollection, typeCache),
            );
        }

        if (validationSettings.checkUnknownIdentifiers && nodeIdMapCollection) {
            validationOperations.push(
                async (): Promise<Diagnostic[]> =>
                    await validateUnknownIdentifiers(validationSettings, nodeIdMapCollection, typeCache),
            );
        }

        // Execute all validation operations sequentially with cancellation support
        const allDiagnostics: Diagnostic[][] = await PromiseUtils.processSequentiallyWithCancellation(
            validationOperations,
            (operation: () => Promise<Diagnostic[]>) => operation(),
            validationSettings.cancellationToken,
        );

        // Flatten all diagnostics into a single array
        const flattenedDiagnostics: Diagnostic[] = allDiagnostics.flat();

        const result: ValidateOk = {
            diagnostics: flattenedDiagnostics,
            hasSyntaxError: parseError !== undefined,
        };

        trace.exit();

        return result;
    }, validationSettings.locale);
}
