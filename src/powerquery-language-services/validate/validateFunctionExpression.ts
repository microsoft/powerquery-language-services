// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Range } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import * as PromiseUtils from "../promiseUtils";

import { Localization, LocalizationUtils } from "../localization";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ILocalizationTemplates } from "../localization/templates";
import { PositionUtils } from "..";
import { ValidationSettings } from "./validationSettings";
import { ValidationTraceConstant } from "../trace";

// Check for repeat parameter names for FunctionExpressions.
export async function validateFunctionExpression(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
): Promise<Diagnostic[]> {
    const trace: Trace = validationSettings.traceManager.entry(
        ValidationTraceConstant.Validation,
        validateFunctionExpression.name,
        validationSettings.initialCorrelationId,
    );

    const updatedSettings: ValidationSettings = {
        ...validationSettings,
        initialCorrelationId: trace.id,
    };

    const fnExpressionIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
        Ast.NodeKind.FunctionExpression,
    );

    if (fnExpressionIds === undefined) {
        trace.exit();

        return [];
    }

    // Yield control to allow for cancellation.
    // If we need more cancellability, we can move this into the loop and yield every N iterations.
    await PromiseUtils.yieldForCancellation(validationSettings.cancellationToken);

    const diagnostics: Diagnostic[][] = [];

    for (const nodeId of fnExpressionIds) {
        const nodeDiagnostics: Diagnostic[] = validateNoDuplicateParameter(
            updatedSettings,
            nodeIdMapCollection,
            nodeId,
        );

        diagnostics.push(nodeDiagnostics);

        // Yield control periodically for better async behavior
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();

        validationSettings.cancellationToken?.throwIfCancelled();
    }

    trace.exit();

    return diagnostics.flat();
}

function validateNoDuplicateParameter(
    validationSettings: ValidationSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    fnExpressionId: number,
): Diagnostic[] {
    const fnExpression: TXorNode = NodeIdMapUtils.assertXorChecked<Ast.FunctionExpression>(
        nodeIdMapCollection,
        fnExpressionId,
        Ast.NodeKind.FunctionExpression,
    );

    const parameterNames: Map<string, Ast.Identifier[]> = new Map();

    for (const parameter of NodeIdMapIterator.iterFunctionExpressionParameterNames(nodeIdMapCollection, fnExpression)) {
        const existingNames: Ast.Identifier[] = parameterNames.get(parameter.literal) ?? [];
        existingNames.push(parameter);
        parameterNames.set(parameter.literal, existingNames);
    }

    const diagnostics: Diagnostic[] = [];

    for (const [identifierLiteral, nodes] of parameterNames) {
        if (nodes.length > 1) {
            diagnostics.push(
                ...nodes.map((identifier: Ast.Identifier) => {
                    const parameterRange: Range = PositionUtils.rangeFromTokenRange(identifier.tokenRange);

                    return createDiagnosticForDuplicateParameterName(
                        validationSettings,
                        parameterRange,
                        identifierLiteral,
                    );
                }),
            );
        }
    }

    return diagnostics;
}

function createDiagnosticForDuplicateParameterName(
    validationSettings: ValidationSettings,
    invokeExpressionRange: Range,
    parameterName: string,
): Diagnostic {
    const templates: ILocalizationTemplates = LocalizationUtils.getLocalizationTemplates(validationSettings.locale);

    return {
        code: DiagnosticErrorCode.DuplicateIdentifier,
        message: Localization.error_validation_duplicate_identifier(templates, parameterName),
        range: invokeExpressionRange,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}
