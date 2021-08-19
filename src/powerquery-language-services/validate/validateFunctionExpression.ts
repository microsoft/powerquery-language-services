// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Range } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

import { Inspection, PositionUtils } from "..";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { Localization, LocalizationUtils } from "../localization";
import { ILocalizationTemplates } from "../localization/templates";
import { ValidationSettings } from "./validationSettings";

export function validateFunctionExpression(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    maybeCache?: Inspection.TypeCache,
): Diagnostic[] {
    const maybeInvokeExpressionIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
        PQP.Language.Ast.NodeKind.FunctionExpression,
    );
    if (maybeInvokeExpressionIds === undefined) {
        return [];
    }

    PQP.Parser.NodeIdMapIterator.

    const result: Diagnostic[] = [];
    for (const nodeId of maybeInvokeExpressionIds) {
        const triedInvokeExpression: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
            validationSettings,
            nodeIdMapCollection,
            nodeId,
            maybeCache,
        );
        if (PQP.ResultUtils.isError(triedInvokeExpression)) {
            throw triedInvokeExpression;
        }

        result.push(
            ...invokeExpressionToDiagnostics(validationSettings, nodeIdMapCollection, triedInvokeExpression.value),
        );
    }

    return result;
}

function invokeExpressionToDiagnostics(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    inspected: Inspection.InvokeExpression,
): Diagnostic[] {
    const result: Diagnostic[] = [];

    if (inspected.maybeArguments !== undefined) {
        const invokeExpressionArguments: Inspection.InvokeExpressionArguments = inspected.maybeArguments;
        const givenArguments: ReadonlyArray<PQP.Parser.TXorNode> = inspected.maybeArguments.givenArguments;
        const invokeExpressionRange: Range = PQP.Assert.asDefined(
            PositionUtils.createRangeFromXorNode(nodeIdMapCollection, inspected.invokeExpressionXorNode),
            "expected at least one leaf node under InvokeExpression",
        );

        const maybeFunctionName: string | undefined = PQP.Parser.NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
            nodeIdMapCollection,
            inspected.invokeExpressionXorNode.node.id,
        );

        for (const [argIndex, mismatch] of invokeExpressionArguments.typeChecked.invalid.entries()) {
            const maybeGivenArgumentRange: Range | undefined = PositionUtils.createRangeFromXorNode(
                nodeIdMapCollection,
                givenArguments[argIndex],
            );

            result.push(
                createDiagnosticForArgumentMismatch(
                    validationSettings,
                    mismatch,
                    maybeFunctionName,
                    invokeExpressionRange,
                    maybeGivenArgumentRange,
                ),
            );
        }

        const numGivenArguments: number = invokeExpressionArguments.givenArguments.length;
        if (
            numGivenArguments < invokeExpressionArguments.numMinExpectedArguments ||
            numGivenArguments > invokeExpressionArguments.numMaxExpectedArguments
        ) {
            result.push(
                createDiagnosticForArgumentNumberMismatch(
                    validationSettings,
                    invokeExpressionRange,
                    invokeExpressionArguments.numMinExpectedArguments,
                    invokeExpressionArguments.numMaxExpectedArguments,
                    numGivenArguments,
                ),
            );
        }
    }

    return result;
}

function createDiagnosticForArgumentNumberMismatch(
    validationSettings: ValidationSettings,
    invokeExpressionRange: Range,
    numMin: number,
    numMax: number,
    numGiven: number,
): Diagnostic {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(validationSettings.locale);

    return {
        code: DiagnosticErrorCode.InvokeArgumentCountMismatch,
        message: Localization.error_validation_invokeExpression_numArgs(templates, numMin, numMax, numGiven),
        range: invokeExpressionRange,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}

function createDiagnosticForArgumentMismatch(
    validationSettings: ValidationSettings,
    mismatch: PQP.Language.TypeUtils.InvocationMismatch,
    maybeFunctionName: string | undefined,
    invokeExpressionRange: Range,
    maybeGivenArgumentRange: Range | undefined,
): Diagnostic {
    let range: Range;
    let message: string;

    const parameter: PQP.Language.Type.FunctionParameter = mismatch.expected;
    const argName: string = parameter.nameLiteral;
    const expected: string = PQP.Language.TypeUtils.nameOfTypeKind(
        parameter.maybeType ?? PQP.Language.Type.AnyInstance.kind,
    );

    // An argument containing at least one leaf node was given.
    if (maybeGivenArgumentRange) {
        const actual: string = PQP.Language.TypeUtils.nameOfTypeKind(PQP.Assert.asDefined(mismatch.actual).kind);

        range = maybeGivenArgumentRange;
        message = createTypeMismatchMessage(validationSettings.locale, maybeFunctionName, argName, expected, actual);
    } else {
        range = invokeExpressionRange;
        message = createMissingMandatoryMessage(validationSettings.locale, maybeFunctionName, argName);
    }

    return {
        code: DiagnosticErrorCode.InvokeArgumentTypeMismatch,
        message,
        range,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}

function createMissingMandatoryMessage(locale: string, maybeFunctionName: string | undefined, argName: string): string {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(locale);
    return Localization.error_validation_invokeExpression_missingMandatory(templates, maybeFunctionName, argName);
}

function createTypeMismatchMessage(
    locale: string,
    maybeFunctionName: string | undefined,
    argName: string,
    expected: string,
    actual: string,
): string {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(locale);
    return Localization.error_validation_invokeExpression_typeMismatch(
        templates,
        maybeFunctionName,
        argName,
        expected,
        actual,
    );
}
