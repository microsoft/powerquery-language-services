// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";
import { Assert } from "@microsoft/powerquery-parser";

import {
    type Diagnostic,
    DiagnosticErrorCode,
    type Position,
    type ValidationSettings,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { assertLessWhenSuppressed } from "../testUtils/validationTestUtils";
import { SimpleLibraryValidateAllSettings } from "../testConstants";

interface AbridgedInvocationDiagnostic {
    readonly message: string;
    readonly startPosition: Position;
}

interface ArgumentMismatchExec {
    readonly abridgedDiagnostic: AbridgedInvocationDiagnostic;
    readonly regExpExecArray: RegExpExecArray;
}

const NumArgumentsPattern: RegExp = /Expected between (\d+)-(\d+) arguments, but (\d+) were given./;

async function assertInvokeExpressionDiagnostics(params: {
    readonly text: string;
    readonly validationSettings?: ValidationSettings;
}): Promise<ReadonlyArray<AbridgedInvocationDiagnostic>> {
    const diagnostics: Diagnostic[] = await TestUtils.assertValidateDiagnostics({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: params.validationSettings ?? TestConstants.SimpleLibraryValidateAllSettings,
    });

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
        const match: RegExpExecArray | null = NumArgumentsPattern.exec(abridgedDiagnostic.message);

        if (match) {
            matches.push({
                abridgedDiagnostic,
                regExpExecArray: match,
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

    expect(actualNumMin).toBe(expectedNumMin);
    expect(actualNumMax).toBe(expectedNumMax);
    expect(actualNumGiven).toBe(expectedNumGiven);
}

function expectInvocationDiagnosticPositions(
    abridgedDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic>,
    expectedStartPositions: ReadonlyArray<Position>,
): void {
    const abridgedPositions: ReadonlyArray<Position> = abridgedDiagnostics.map(
        (abridged: AbridgedInvocationDiagnostic) => abridged.startPosition,
    );

    expect(abridgedPositions).toEqual(expectedStartPositions);
}

describe("Validation - InvokeExpression", () => {
    describe(`checkInvokeExpressions = false`, () => {
        it(`argument count suppressed`, async () => {
            const text: string = `${TestConstants.TestLibraryName.SquareIfNumber}()`;

            const withCheckSettings: ValidationSettings = {
                ...SimpleLibraryValidateAllSettings,
                checkInvokeExpressions: true,
            };

            const withoutCheckSettings: ValidationSettings = {
                ...SimpleLibraryValidateAllSettings,
                checkInvokeExpressions: false,
            };

            await assertLessWhenSuppressed({
                text,
                withCheckSettings,
                withoutCheckSettings,
            });
        });
    });

    describe(`single invocation`, () => {
        it(`expects [1, 1] arguments, 0 given`, async () => {
            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                await assertInvokeExpressionDiagnostics({
                    text: `${TestConstants.TestLibraryName.SquareIfNumber}()`,
                });

            expectArgumentCountMismatch(invocationDiagnostics, 1, 1, 0);
        });

        it(`expects [1, 2] arguments, 0 given`, async () => {
            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                await assertInvokeExpressionDiagnostics({
                    text: `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}()`,
                });

            expectArgumentCountMismatch(invocationDiagnostics, 1, 2, 0);
        });

        it(`expects [1, 2] arguments, 2 given`, async () => {
            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                await assertInvokeExpressionDiagnostics({
                    text: `${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(0, "")`,
                });

            expect(invocationDiagnostics.length).toBe(0);
        });
    });

    describe(`multiple invocation`, () => {
        it(`position for multiple errors`, async () => {
            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                await assertInvokeExpressionDiagnostics({
                    text: `let
                        x = ${TestConstants.TestLibraryName.CombineNumberAndOptionalText}(),
                        y = ${TestConstants.TestLibraryName.CombineNumberAndOptionalText}()
                    in
                        _`,
                });

            expect(invocationDiagnostics.length).toBe(2);

            const expected: ReadonlyArray<Position> = [
                {
                    character: 61,
                    line: 1,
                },
                {
                    character: 61,
                    line: 2,
                },
            ];

            expectInvocationDiagnosticPositions(invocationDiagnostics, expected);
        });
    });

    describe(`standard library`, () => {
        it(`let Source = #table(type table [ID = number], {{1}}), First = Table.FirstN(Source, 1) in Source`, async () => {
            const invocationDiagnostics: ReadonlyArray<AbridgedInvocationDiagnostic> =
                await assertInvokeExpressionDiagnostics({
                    text: `let
                        Source = #table(type table [ID = number], {{1}}),
                        WithColumn = Table.AddColumn(Source, "NewColumn", each [ID] + 1),
                        First = Table.FirstN(WithColumn, 1)
                    in
                        First`,
                    validationSettings: TestConstants.StandardLibraryValidateAllSettings,
                });

            const expected: ReadonlyArray<Position> = [
                {
                    character: 53,
                    line: 2,
                },
                {
                    character: 45,
                    line: 3,
                },
            ];

            expectInvocationDiagnosticPositions(invocationDiagnostics, expected);
        });
    });
});
