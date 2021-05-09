// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Range } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

import { Inspection, PositionUtils } from "..";
import { DiagnosticErrorCode } from "../diagnosticErrorCode";
import { ValidationSettings } from "./validationSettings";

export function validateInvokeExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    validationSettings: ValidationSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    maybeCache?: Inspection.TypeCache,
): Diagnostic[] {
    const maybeInvokeExpressionIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
        PQP.Language.Ast.NodeKind.InvokeExpression,
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
        if (PQP.ResultUtils.isError(triedInvokeExpression)) {
            throw triedInvokeExpression;
        }

        result.push(
            ...invokeExpressionToDiagnostics(validationSettings, nodeIdMapCollection, triedInvokeExpression.value),
        );
    }

    return result;
}

function invokeExpressionToDiagnostics<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    valdiationSettings: ValidationSettings<S>,
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
                createDiagnosticForMismatch(
                    valdiationSettings,
                    mismatch,
                    maybeFunctionName,
                    invokeExpressionRange,
                    maybeGivenArgumentRange,
                ),
            );
        }

        const numGivenArguments: number = invokeExpressionArguments.givenArguments.length;
        if (
            numGivenArguments < invokeExpressionArguments.numMaxExpectedArguments ||
            numGivenArguments > invokeExpressionArguments.numMaxExpectedArguments
        ) {
            result.push({
                code: DiagnosticErrorCode.InvokeArgumentCountMismatch,
                message: `Expected between ${invokeExpressionArguments.numMinExpectedArguments} and ${invokeExpressionArguments.numMaxExpectedArguments} arguments, but ${numGivenArguments} were given.`,
                range: invokeExpressionRange,
                severity: DiagnosticSeverity.Error,
                source: valdiationSettings.source,
            });
        }
    }

    return result;
}

function createDiagnosticForMismatch<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    validationSettings: ValidationSettings<S>,
    mismatch: PQP.Language.TypeUtils.InvocationMismatch,
    maybeFunctionName: string | undefined,
    invokeExpressionRange: Range,
    maybeGivenArgumentRange: Range | undefined,
): Diagnostic {
    let range: Range;
    let message: string;

    const expected: PQP.Language.Type.FunctionParameter = mismatch.expected;

    // An argument containing at least one leaf node was given.
    if (maybeGivenArgumentRange) {
        const expectedTypeKindMessage: string = PQP.Language.TypeUtils.nameOfTypeKind(
            expected.maybeType ?? PQP.Language.Type.AnyInstance.kind,
        );

        const actual: PQP.Language.Type.TPowerQueryType = PQP.Assert.asDefined(mismatch.actual);
        const actualTypeKindMessage: string = PQP.Language.TypeUtils.nameOfTypeKind(actual.kind);

        range = maybeGivenArgumentRange;
        if (maybeFunctionName) {
            message = `'${maybeFunctionName} expected the argument for '${expected.nameLiteral}' to be '${expectedTypeKindMessage}', but got '${actualTypeKindMessage}' instead.`;
        } else {
            message = `Expected the argument for '${expected.nameLiteral}' to be '${expectedTypeKindMessage}', but got '${actualTypeKindMessage}' instead.`;
        }
    } else {
        range = invokeExpressionRange;
        if (maybeFunctionName) {
            message = `'${maybeFunctionName}' is missing an argument for the non-optional parameter '${expected.nameLiteral}'.`;
        } else {
            message = `Missing an argument for the non-optional parameter '${expected.nameLiteral}'.`;
        }
    }

    return {
        code: DiagnosticErrorCode.InvokeArgumentTypeMismatch,
        message,
        range,
        severity: DiagnosticSeverity.Error,
        source: validationSettings.source,
    };
}
