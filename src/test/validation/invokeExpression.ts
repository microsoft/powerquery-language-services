// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import {
    Diagnostic,
    DiagnosticErrorCode,
    Position,
    TextDocument,
    ValidationSettings,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { SimpleValidationSettings } from "../testConstants";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

interface AbridgedInvocationDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

interface ArgumentMismatchExec {
    readonly abridgedDiagnostic: AbridgedInvocationDiagnostic;
    readonly regExpExecArray: RegExpExecArray;
}

const NumArgumentsPattern: RegExp = /Expected between (\d+)-(\d+) arguments, but (\d+) were given./;

function expectGetInvokeExpressionDiagnostics(textDocument: TextDocument): ReadonlyArray<AbridgedInvocationDiagnostic> {
    const validationResult: ValidationResult = TestUtils.assertGetValidationResult(textDocument);
    const diagnostics: Diagnostic[] = validationResult.diagnostics;

    return diagnostics
        .filter(
            (diagnostic: Diagnostic) =>
                diagnostic.code === DiagnosticErrorCode.InvokeArgumentCountMismatch ||
                diagnostic.code === DiagnosticErrorCode.InvokeArgumentTypeMismatch,
        )
        .map((diagnostic: Diagnostic) => ({
            message: diagnostic.message,
            startPosition: Assert.asDefined(diagnostic.range).start,
        }));
}

function expectArgumentCountMismatch(
    abridgedDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic>,
    expectedNumMin: number,
    expectedNumMax: number,
    expectedNumGiven: number,
): void {
    const matches: ArgumentMismatchExec[] = [];

    for (const abridgedDiagnostic of abridgedDiagnostics) {
        const maybeMatch: RegExpExecArray | null = NumArgumentsPattern.exec(abridgedDiagnostic.message);

        if (maybeMatch) {
            matches.push({
                abridgedDiagnostic,
                regExpExecArray: maybeMatch,
            });
        }
    }

    if (matches.length !== 1) {
        throw new Error(`expected exactly one invocation diagnostic error, but ${matches.length} were found.`);
    }

    const { regExpExecArray }: { regExpExecArray: RegExpExecArray } = matches[0];

    const actualNumMin: number = Number.parseInt(Assert.asDefined(regExpExecArray[1], "expected capture group 1"), 10);
    const actualNumMax: number = Number.parseInt(Assert.asDefined(regExpExecArray[2], "expected capture group 2"), 10);

    const actualNumGiven: number = Number.parseInt(
        Assert.asDefined(regExpExecArray[3], "expected capture group 3"),
        10,
    );

    expect(actualNumMin).to.equal(expectedNumMin);
    expect(actualNumMax).to.equal(expectedNumMax);
    expect(actualNumGiven).to.equal(expectedNumGiven);
}

function expectInvocationDiagnosticPositions(
    abridgedDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic>,
    expectedStartPositions: ReadonlyArray<Position>,
): void {
    const abridgedPositions: ReadonlyArray<Position> = abridgedDiagnostics.map(
        (abridged: AbridgedInvocationDiagnostic) => abridged.startPosition,
    );

    expect(abridgedPositions).to.deep.equal(expectedStartPositions);
}

describe("Validation - InvokeExpression", () => {
    describe(`checkInvokeExpressions = false`, () => {
        const validationSettings: ValidationSettings = {
            ...SimpleValidationSettings,
            checkInvokeExpressions: false,
        };

        it(`argument count suppressed`, () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `${TestConstants.TestLibraryName.SquareIfNumber}()`,
            );

            const validationResult: ValidationResult = PQLS.validate(textDocument, validationSettings);
            expect(validationResult.diagnostics.length).to.equal(0);
        });
    });

    describe(`single invocation`, () => {
        it(`expects [1, 1] arguments, 0 given`, () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `${TestConstants.TestLibraryName.SquareIfNumber}()`,
            );

            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                expectGetInvokeExpressionDiagnostics(textDocument);

            expectArgumentCountMismatch(invocationDiagnostics, 1, 1, 0);
        });

        it(`expects [1, 2] arguments, 0 given`, () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}()`,
            );

            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                expectGetInvokeExpressionDiagnostics(textDocument);

            expectArgumentCountMismatch(invocationDiagnostics, 1, 2, 0);
        });

        it(`expects [1, 2] arguments, 2 given`, () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(0, "")`,
            );

            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                expectGetInvokeExpressionDiagnostics(textDocument);

            expect(invocationDiagnostics.length).to.equal(0);
        });
    });

    describe(`multiple invocation`, () => {
        it(`position for multiple errors`, () => {
            const textDocument: TextDocument = TestUtils.createTextMockDocument(
                `
let 
    x = ${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(),
    y = ${TestConstants.TestLibraryName.CombineNumberAndOptionalText}()
in
    _`,
            );

            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                expectGetInvokeExpressionDiagnostics(textDocument);

            expect(invocationDiagnostics.length).to.equal(2);

            const expected: ReadonlyArray<Position> = [
                {
                    character: 41,
                    line: 2,
                },
                {
                    character: 41,
                    line: 3,
                },
            ];

            expectInvocationDiagnosticPositions(invocationDiagnostics, expected);
        });
    });
});
