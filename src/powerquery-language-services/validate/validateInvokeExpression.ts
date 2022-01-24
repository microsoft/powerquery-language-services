// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { NodeIdMap, NodeIdMapUtils, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Range } from "vscode-languageserver-textdocument";

import { Inspection, PositionUtils } from "..";
import { Localization, LocalizationUtils } from "../localization";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ILocalizationTemplates } from "../localization/templates";
import { ValidationSettings } from "./validationSettings";

export function validateInvokeExpression(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    maybeCache?: Inspection.TypeCache,
): Diagnostic[] {
    const maybeInvokeExpressionIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
        Ast.NodeKind.InvokeExpression,
    );

    if (maybeInvokeExpressionIds === undefined) {
        return [];
    }

    const result: Diagnostic[] = [];

    for (const nodeId of maybeInvokeExpressionIds) {
        const triedInvokeExpression: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
            validationSettings,
            nodeIdMapCollection,
            nodeId,
            maybeCache,
        );

        if (ResultUtils.isError(triedInvokeExpression)) {
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
    nodeIdMapCollection: NodeIdMap.Collection,
    inspected: Inspection.InvokeExpression,
): Diagnostic[] {
    const result: Diagnostic[] = [];

    if (inspected.maybeArguments !== undefined) {
        const invokeExpressionArguments: Inspection.InvokeExpressionArguments = inspected.maybeArguments;
        const givenArguments: ReadonlyArray<TXorNode> = inspected.maybeArguments.givenArguments;

        const invokeExpressionRange: Range = Assert.asDefined(
            PositionUtils.createRangeFromXorNode(nodeIdMapCollection, inspected.invokeExpressionXorNode),
            "expected at least one leaf node under InvokeExpression",
        );

        const maybeFunctionName: string | undefined = NodeIdMapUtils.maybeInvokeExpressionIdentifierLiteral(
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
    mismatch: TypeUtils.InvocationMismatch,
    maybeFunctionName: string | undefined,
    invokeExpressionRange: Range,
    maybeGivenArgumentRange: Range | undefined,
): Diagnostic {
    let range: Range;
    let message: string;

    const parameter: Type.FunctionParameter = mismatch.expected;
    const argName: string = parameter.nameLiteral;
    const expected: string = TypeUtils.nameOfTypeKind(parameter.maybeType ?? Type.AnyInstance.kind);

    // An argument containing at least one leaf node was given.
    if (maybeGivenArgumentRange) {
        const actual: string = TypeUtils.nameOfTypeKind(Assert.asDefined(mismatch.actual).kind);

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
