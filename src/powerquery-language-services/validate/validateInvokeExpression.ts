// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { NodeIdMap, NodeIdMapUtils, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import type { Range } from "vscode-languageserver-textdocument";

import { Inspection, PositionUtils } from "..";
import { Localization, LocalizationUtils } from "../localization";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ILocalizationTemplates } from "../localization/templates";
import { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

export async function validateInvokeExpression(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    typeCache: Inspection.TypeCache,
): Promise<Diagnostic[]> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateInvokeExpression.name,
        validationSettings.initialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        initialCorrelationId: trace.id,
    };

    const invokeExpressionIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
        Ast.NodeKind.InvokeExpression,
    );

    if (invokeExpressionIds === undefined) {
        trace.exit();

        return [];
    }

    const inspectionTasks: Promise<Inspection.TriedInvokeExpression>[] = [];

    for (const nodeId of invokeExpressionIds) {
        validationSettings.cancellationToken?.throwIfCancelled();

        inspectionTasks.push(Inspection.tryInvokeExpression(updatedSettings, nodeIdMapCollection, nodeId, typeCache));
    }

    const inspections: ReadonlyArray<Inspection.TriedInvokeExpression> = await Promise.all(inspectionTasks);

    const diagnosticTasks: Promise<ReadonlyArray<Diagnostic>>[] = [];

    for (const triedInvokeExpression of inspections) {
        validationSettings.cancellationToken?.throwIfCancelled();

        if (ResultUtils.isOk(triedInvokeExpression)) {
            diagnosticTasks.push(
                invokeExpressionToDiagnostics(updatedSettings, nodeIdMapCollection, triedInvokeExpression.value),
            );
        } else {
            trace.exit({ [TraceConstant.IsThrowing]: true });

            throw triedInvokeExpression;
        }
    }

    const diagnostics: ReadonlyArray<ReadonlyArray<Diagnostic>> = await Promise.all(diagnosticTasks);
    trace.exit();

    return diagnostics.flat();
}

async function invokeExpressionToDiagnostics(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    inspected: Inspection.InvokeExpression,
): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];

    if (inspected.arguments !== undefined) {
        const invokeExpressionArguments: Inspection.InvokeExpressionArguments = inspected.arguments;
        const givenArguments: ReadonlyArray<TXorNode> = inspected.arguments.givenArguments;

        const invokeExpressionRange: Range = Assert.asDefined(
            await PositionUtils.rangeFromXorNode(nodeIdMapCollection, inspected.invokeExpressionXorNode),
            "expected at least one leaf node under InvokeExpression",
        );

        const functionName: string | undefined = NodeIdMapUtils.invokeExpressionIdentifierLiteral(
            nodeIdMapCollection,
            inspected.invokeExpressionXorNode.node.id,
        );

        for (const [argIndex, mismatch] of invokeExpressionArguments.typeChecked.invalid.entries()) {
            validationSettings.cancellationToken?.throwIfCancelled();

            // eslint-disable-next-line no-await-in-loop
            const givenArgRange: Range | undefined = await PositionUtils.rangeFromXorNode(
                nodeIdMapCollection,
                givenArguments[argIndex],
            );

            result.push(
                createDiagnosticForArgumentMismatch(
                    validationSettings,
                    mismatch,
                    functionName,
                    invokeExpressionRange,
                    givenArgRange,
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
    functionName: string | undefined,
    invokeExpressionRange: Range,
    givenArgRange: Range | undefined,
): Diagnostic {
    let range: Range;
    let message: string;

    const parameter: Type.FunctionParameter = mismatch.expected;
    const argName: string = parameter.nameLiteral;
    const expected: string = TypeUtils.nameOfTypeKind(parameter.type ?? Type.AnyInstance.kind);

    // An argument containing at least one leaf node was given.
    if (givenArgRange) {
        const actual: string = TypeUtils.nameOfTypeKind(Assert.asDefined(mismatch.actual).kind);

        range = givenArgRange;
        message = createTypeMismatchMessage(validationSettings.locale, functionName, argName, expected, actual);
    } else {
        range = invokeExpressionRange;
        message = createMissingMandatoryMessage(validationSettings.locale, functionName, argName);
    }

    return {
        code: DiagnosticErrorCode.InvokeArgumentTypeMismatch,
        message,
        range,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}

function createMissingMandatoryMessage(locale: string, functionName: string | undefined, argName: string): string {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(locale);

    return Localization.error_validation_invokeExpression_missingMandatory(templates, functionName, argName);
}

function createTypeMismatchMessage(
    locale: string,
    functionName: string | undefined,
    argName: string,
    expected: string,
    actual: string,
): string {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(locale);

    return Localization.error_validation_invokeExpression_typeMismatch(
        templates,
        functionName,
        argName,
        expected,
        actual,
    );
}
