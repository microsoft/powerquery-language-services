// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import { Assert } from "@microsoft/powerquery-parser";
import "mocha";

import { TestConstants, TestUtils } from "..";
import { Diagnostic, DiagnosticErrorCode, Position, TextDocument } from "../../powerquery-language-services";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

interface AbridgedInvocationDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

function expectGetInvokeExpressionDiagnostics(textDocument: TextDocument): ReadonlyArray<AbridgedInvocationDiagnostic> {
    const validationResult: ValidationResult = TestUtils.assertGetValidationResult(textDocument);
    const diagnostics: Diagnostic[] = validationResult.diagnostics;

    return diagnostics
        .filter(
            (diagnostic: Diagnostic) =>
                diagnostic.code === DiagnosticErrorCode.InvokeArgumentCountMismatch ||
                diagnostic.code === DiagnosticErrorCode.InvokeArgumentTypeMismatch,
        )
        .map((diagnostic: Diagnostic) => {
            return {
                message: diagnostic.message,
                startPosition: Assert.asDefined(diagnostic.range).start,
            };
        });
}

function expectArgumentCountMismatch(
    abridgedDiagnostics: AbridgedInvocationDiagnostic,
    expectedNumMin: number,
    expectedNumMax: number,
    actualNum: number,
): void {}

describe("Validation - InvokeExpression", () => {
    it(`missing argument`, () => {
        const textDocument: TextDocument = TestUtils.createTextMockDocument(
            `${TestConstants.TestLibraryName.SquareIfNumber}()`,
        );
        const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> = expectGetInvokeExpressionDiagnostics(
            textDocument,
        );
    });
});
