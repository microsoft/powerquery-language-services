// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";

import { type Diagnostic, DiagnosticErrorCode, type ValidationSettings } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { type ValidateOk } from "../../powerquery-language-services/validate/validateOk";

const TestExpressions: {
    readonly NoErrors: string;
    readonly SyntaxError: string;
    readonly DuplicateIdentifier: string;
    readonly DuplicateIdentifierAndSyntaxError: string;
} = {
    NoErrors: "let x = 1, y = 2 in y",
    SyntaxError: "let x , in x",
    DuplicateIdentifier: "let x = 1, x = 2, y = 3 in y",
    DuplicateIdentifierAndSyntaxError: "let x = 1, x = 2, y = in y",
} as const;

// Test settings with checkDiagnosticsOnParseError = false
const defaultValidationSettings: ValidationSettings = {
    ...TestConstants.SimpleLibraryValidateAllSettings,
};

async function runTest(params: {
    readonly text: string;
    readonly checkDiagnosticsOnParseError?: boolean;
    readonly expected: {
        readonly diagnosticsCount: number;
        readonly hasSyntaxError: boolean;
    };
}): Promise<ValidateOk> {
    const validationSettings: ValidationSettings = {
        ...defaultValidationSettings,
        checkDiagnosticsOnParseError:
            params.checkDiagnosticsOnParseError ?? defaultValidationSettings.checkDiagnosticsOnParseError,
    };

    const validationResult: ValidateOk = await TestUtils.assertValidate({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings,
    });

    // unexpected diagnostics count
    expect(validationResult.diagnostics.length).toBe(params.expected.diagnosticsCount);

    // unexpected value for hasSyntaxError
    expect(validationResult.hasSyntaxError).toBe(params.expected.hasSyntaxError);

    if (params.expected.hasSyntaxError) {
        const hasParseError: boolean = validationResult.diagnostics.some(
            (diagnostic: Diagnostic) => diagnostic.code === DiagnosticErrorCode.ParseError,
        );

        // expected at least one Error.Parse diagnostic when hasSyntaxError is true
        expect(hasParseError).toBe(true);
    }

    return validationResult;
}

// Test cases data structure
interface TestCase {
    readonly name: string;
    readonly text: string;
    readonly expectedWhenTrue: { readonly diagnosticsCount: number; readonly hasSyntaxError: boolean };
    readonly expectedWhenFalse: { readonly diagnosticsCount: number; readonly hasSyntaxError: boolean };
    readonly expectedDefault: { readonly diagnosticsCount: number; readonly hasSyntaxError: boolean };
}

const testCases: TestCase[] = [
    {
        name: "both parse errors and other diagnostics",
        text: TestExpressions.DuplicateIdentifierAndSyntaxError,
        expectedWhenTrue: { diagnosticsCount: 3, hasSyntaxError: true },
        expectedWhenFalse: { diagnosticsCount: 1, hasSyntaxError: true },
        expectedDefault: { diagnosticsCount: 3, hasSyntaxError: true },
    },
    {
        name: "only syntax error",
        text: TestExpressions.SyntaxError,
        expectedWhenTrue: { diagnosticsCount: 1, hasSyntaxError: true },
        expectedWhenFalse: { diagnosticsCount: 1, hasSyntaxError: true },
        expectedDefault: { diagnosticsCount: 1, hasSyntaxError: true },
    },
    {
        name: "other diagnostics (no syntax error)",
        text: TestExpressions.DuplicateIdentifier,
        expectedWhenTrue: { diagnosticsCount: 2, hasSyntaxError: false },
        expectedWhenFalse: { diagnosticsCount: 2, hasSyntaxError: false },
        expectedDefault: { diagnosticsCount: 2, hasSyntaxError: false },
    },
    {
        name: "no errors",
        text: TestExpressions.NoErrors,
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
