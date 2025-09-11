// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Diagnostic, DiagnosticErrorCode, ValidationSettings } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";

// Test settings with checkDiagnosticsOnParseError = false
const defaultValidationSettings: ValidationSettings = {
    ...TestConstants.SimpleLibraryValidateAllSettings,
};

const expressionNoErrors: string = `let x = 1, y = 2 in y`;
const expressionSyntaxError: string = `let x , in x`;
const expressionDuplicateIdentifier: string = `let x = 1, x = 2, y = 3 in y`;
const expressionDuplicateIdentifierAndSyntaxError: string = `let x = 1, x = 2, y = in y`;

async function runTest(params: {
    readonly text: string;
    readonly checkDiagnosticsOnParseError?: boolean;
    readonly expected: {
        readonly diagnosticsCount: number;
        readonly hasSyntaxError: boolean;
    };
}): Promise<ValidateOk> {
    const validationSettings: ValidationSettings =
        params.checkDiagnosticsOnParseError !== undefined
            ? { ...defaultValidationSettings, checkDiagnosticsOnParseError: params.checkDiagnosticsOnParseError }
            : { ...defaultValidationSettings };

    const validationResult: ValidateOk = await TestUtils.assertValidate({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings,
    });

    expect(validationResult.diagnostics.length).to.equal(
        params.expected.diagnosticsCount,
        "unexpected diagnostics count",
    );

    expect(validationResult.hasSyntaxError).to.equal(
        params.expected.hasSyntaxError,
        "unexpected value for hasSyntaxError",
    );

    if (params.expected.hasSyntaxError) {
        const hasParseError: boolean = validationResult.diagnostics.some(
            (diagnostic: Diagnostic) => diagnostic.code === DiagnosticErrorCode.ParseError,
        );

        expect(hasParseError).to.equal(
            true,
            "expected at least one Error.Parse diagnostic when hasSyntaxError is true",
        );
    }

    return validationResult;
}

// Test cases data structure
interface TestCase {
    readonly name: string;
    readonly text: string;
    readonly expectedWhenTrue: { diagnosticsCount: number; hasSyntaxError: boolean };
    readonly expectedWhenFalse: { diagnosticsCount: number; hasSyntaxError: boolean };
    readonly expectedDefault: { diagnosticsCount: number; hasSyntaxError: boolean };
}

const testCases: TestCase[] = [
    {
        name: "both parse errors and other diagnostics",
        text: expressionDuplicateIdentifierAndSyntaxError,
        expectedWhenTrue: { diagnosticsCount: 3, hasSyntaxError: true },
        expectedWhenFalse: { diagnosticsCount: 1, hasSyntaxError: true },
        expectedDefault: { diagnosticsCount: 3, hasSyntaxError: true },
    },
    {
        name: "only syntax error",
        text: expressionSyntaxError,
        expectedWhenTrue: { diagnosticsCount: 1, hasSyntaxError: true },
        expectedWhenFalse: { diagnosticsCount: 1, hasSyntaxError: true },
        expectedDefault: { diagnosticsCount: 1, hasSyntaxError: true },
    },
    {
        name: "other diagnostics (no syntax error)",
        text: expressionDuplicateIdentifier,
        expectedWhenTrue: { diagnosticsCount: 2, hasSyntaxError: false },
        expectedWhenFalse: { diagnosticsCount: 2, hasSyntaxError: false },
        expectedDefault: { diagnosticsCount: 2, hasSyntaxError: false },
    },
    {
        name: "no errors",
        text: expressionNoErrors,
        expectedWhenTrue: { diagnosticsCount: 0, hasSyntaxError: false },
        expectedWhenFalse: { diagnosticsCount: 0, hasSyntaxError: false },
        expectedDefault: { diagnosticsCount: 0, hasSyntaxError: false },
    },
];

describe("checkDiagnosticsOnParseError validation setting", () => {
    describe("when checkDiagnosticsOnParseError is true", () => {
        testCases.forEach((testCase: TestCase) => {
            it(`should handle ${testCase.name}`, async () => {
                await runTest({
                    text: testCase.text,
                    checkDiagnosticsOnParseError: true,
                    expected: testCase.expectedWhenTrue,
                });
            });
        });
    });

    describe("when checkDiagnosticsOnParseError is false", () => {
        testCases.forEach((testCase: TestCase) => {
            it(`should handle ${testCase.name}`, async () => {
                await runTest({
                    text: testCase.text,
                    checkDiagnosticsOnParseError: false,
                    expected: testCase.expectedWhenFalse,
                });
            });
        });
    });

    describe("checkDiagnosticsOnParseError default value", () => {
        testCases.forEach((testCase: TestCase) => {
            it(`should use default behavior for ${testCase.name}`, async () => {
                await runTest({
                    text: testCase.text,
                    expected: testCase.expectedDefault,
                });
            });
        });
    });
});
