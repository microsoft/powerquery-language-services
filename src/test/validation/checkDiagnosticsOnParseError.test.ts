// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Diagnostic, DiagnosticSeverity, ValidationSettings } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { assertLessWhenSuppressed } from "../testUtils/validationTestUtils";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";

// Test settings with checkDiagnosticsOnParseError = false
const validateWithoutDiagnosticsOnParseErrorSettings: ValidationSettings = {
    ...TestConstants.SimpleLibraryValidateAllSettings,
    checkDiagnosticsOnParseError: false,
};

describe("checkDiagnosticsOnParseError validation setting", () => {
    describe("when checkDiagnosticsOnParseError is true", () => {
        it("should return both parse errors and other diagnostics when there's a syntax error", async () => {
            // This text has both a syntax error and a duplicate identifier
            const text: string = `
                let
                    x = 1,
                    x = 2,  // duplicate identifier
                    y =     // syntax error - missing value
                in
                    y
            `;

            const validationResult: ValidateOk = await TestUtils.assertValidate({
                text,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                validationSettings: TestConstants.SimpleLibraryValidateAllSettings,
            });

            expect(validationResult.hasSyntaxError).to.equal(true, "hasSyntaxError flag should be true");

            expect(validationResult.diagnostics.length).to.equal(
                3,
                "should have parse error + duplicate identifier diagnostics",
            );

            // Should have at least one parse error
            const parseErrors: Diagnostic[] = validationResult.diagnostics.filter(
                (diagnostic: Diagnostic) => diagnostic.severity === DiagnosticSeverity.Error,
            );

            expect(parseErrors.length).to.be.greaterThan(0, "should have parse errors");
        });

        it("should return only other diagnostics when there's no syntax error", async () => {
            // This text has no syntax error but has a duplicate identifier
            const text: string = `
                let
                    x = 1,
                    x = 2   // duplicate identifier
                in
                    x
            `;

            const validationResult: ValidateOk = await TestUtils.assertValidate({
                text,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                validationSettings: TestConstants.SimpleLibraryValidateAllSettings,
            });

            expect(validationResult.hasSyntaxError).to.equal(false, "hasSyntaxError flag should be false");

            expect(validationResult.diagnostics.length).to.equal(
                2,
                "should have exactly two diagnostics for duplicate identifier",
            );
        });
    });

    describe("when checkDiagnosticsOnParseError is false", () => {
        it("should return fewer diagnostics than when checkDiagnosticsOnParseError is true", async () => {
            // This text has both a syntax error and a duplicate identifier
            const text: string = `
                let
                    x = 1,
                    x = 2,  // duplicate identifier
                    y =     // syntax error - missing value
                in
                    y
            `;

            await assertLessWhenSuppressed({
                text,
                withCheckSettings: TestConstants.SimpleLibraryValidateAllSettings,
                withoutCheckSettings: validateWithoutDiagnosticsOnParseErrorSettings,
            });
        });

        it("should return only parse errors when there's a syntax error", async () => {
            // This text has both a syntax error and a duplicate identifier
            const text: string = `
                let
                    x = 1,
                    x = 2,  // duplicate identifier
                    y =     // syntax error - missing value
                in
                    y
            `;

            const validationResult: ValidateOk = await TestUtils.assertValidate({
                text,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                validationSettings: validateWithoutDiagnosticsOnParseErrorSettings,
            });

            expect(validationResult.hasSyntaxError).to.equal(true, "hasSyntaxError flag should be true");

            // Should have only parse errors, no duplicate identifier diagnostics
            expect(validationResult.diagnostics.length).to.equal(1, "should have only parse error diagnostics");

            // All diagnostics should be parse errors (severity: Error)
            const parseErrors: Diagnostic[] = validationResult.diagnostics.filter(
                (diagnostic: Diagnostic) => diagnostic.severity === DiagnosticSeverity.Error,
            );

            expect(parseErrors.length).to.equal(
                validationResult.diagnostics.length,
                "all diagnostics should be parse errors",
            );
        });

        it("should return all diagnostics when there's no syntax error", async () => {
            // This text has no syntax error but has a duplicate identifier
            const text: string = `
                let
                    x = 1,
                    x = 2   // duplicate identifier
                in
                    x
            `;

            const validationResult: ValidateOk = await TestUtils.assertValidate({
                text,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                validationSettings: validateWithoutDiagnosticsOnParseErrorSettings,
            });

            expect(validationResult.hasSyntaxError).to.equal(false, "hasSyntaxError flag should be false");

            expect(validationResult.diagnostics.length).to.equal(
                2,
                "should have exactly two diagnostics for duplicate identifier",
            );
        });
    });

    describe("backwards compatibility", () => {
        it("should default to true when checkDiagnosticsOnParseError is not specified", async () => {
            const text: string = `
                let
                    x = 1,
                    x = 2,  // duplicate identifier
                    y =     // syntax error - missing value
                in
                    y
            `;

            const validationResult: ValidateOk = await TestUtils.assertValidate({
                text,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                validationSettings: TestConstants.SimpleLibraryValidateAllSettings,
            });

            expect(validationResult.hasSyntaxError).to.equal(true, "hasSyntaxError flag should be true");

            expect(validationResult.diagnostics.length).to.equal(
                3,
                "should have parse error + duplicate identifier diagnostics (backwards compatible behavior)",
            );
        });
    });
});
