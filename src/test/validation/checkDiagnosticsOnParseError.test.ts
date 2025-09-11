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

describe("checkDiagnosticsOnParseError validation setting", () => {
    describe("when checkDiagnosticsOnParseError is true", () => {
        it("should return both parse errors and other diagnostics when there's a syntax error", async () => {
            await runTest({
                text: expressionDuplicateIdentifierAndSyntaxError,
                checkDiagnosticsOnParseError: true,
                expected: {
                    diagnosticsCount: 3,
                    hasSyntaxError: true,
                },
            });
        });

        it("should return only syntax error when there's only a syntax error", async () => {
            await runTest({
                text: expressionSyntaxError,
                checkDiagnosticsOnParseError: true,
                expected: {
                    diagnosticsCount: 1,
                    hasSyntaxError: true,
                },
            });
        });

        it("should return other diagnostics when there's no syntax error", async () => {
            await runTest({
                text: expressionDuplicateIdentifier,
                checkDiagnosticsOnParseError: true,
                expected: {
                    diagnosticsCount: 2,
                    hasSyntaxError: false,
                },
            });
        });

        it("should return no diagnostics when there are no errors", async () => {
            await runTest({
                text: expressionNoErrors,
                checkDiagnosticsOnParseError: true,
                expected: {
                    diagnosticsCount: 0,
                    hasSyntaxError: false,
                },
            });
        });
    });

    describe("when checkDiagnosticsOnParseError is false", () => {
        it("should skip other diagnostics when there's a syntax error", async () => {
            await runTest({
                text: expressionDuplicateIdentifierAndSyntaxError,
                checkDiagnosticsOnParseError: false,
                expected: {
                    diagnosticsCount: 1,
                    hasSyntaxError: true,
                },
            });
        });

        it("should return only syntax error when there's only a syntax error", async () => {
            await runTest({
                text: expressionSyntaxError,
                checkDiagnosticsOnParseError: false,
                expected: {
                    diagnosticsCount: 1,
                    hasSyntaxError: true,
                },
            });
        });

        it("should return other diagnostics when there's no syntax error", async () => {
            await runTest({
                text: expressionDuplicateIdentifier,
                checkDiagnosticsOnParseError: false,
                expected: {
                    diagnosticsCount: 2,
                    hasSyntaxError: false,
                },
            });
        });

        it("should return no diagnostics when there are no errors", async () => {
            await runTest({
                text: expressionNoErrors,
                checkDiagnosticsOnParseError: false,
                expected: {
                    diagnosticsCount: 0,
                    hasSyntaxError: false,
                },
            });
        });
    });

    describe("checkDiagnosticsOnParseError default value", () => {
        it("checkDiagnosticsOnParseError should default to true", async () => {
            await runTest({
                text: expressionDuplicateIdentifierAndSyntaxError,
                expected: {
                    diagnosticsCount: 3,
                    hasSyntaxError: true,
                },
            });
        });

        it("should handle no errors case with default settings", async () => {
            await runTest({
                text: expressionNoErrors,
                expected: {
                    diagnosticsCount: 0,
                    hasSyntaxError: false,
                },
            });
        });
    });
});
