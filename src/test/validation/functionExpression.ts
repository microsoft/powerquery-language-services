// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";

import {
    Diagnostic,
    DiagnosticErrorCode,
    DiagnosticSeverity,
    Position,
    validate,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { MockDocument } from "../mockDocument";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

function assertValidationError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

async function expectNoValidationErrors(textDocument: MockDocument): Promise<void> {
    const validationResult: ValidationResult = await validate(
        textDocument,
        TestConstants.SimpleLibraryAnalysisSettings,
        TestConstants.SimpleValidateAllSettings,
        undefined,
    );

    expect(validationResult.hasSyntaxError).to.equal(false, "hasSyntaxError flag should be false");
    expect(validationResult.diagnostics.length).to.equal(0, "no diagnostics expected");
}

describe(`Validation - functionExpression`, () => {
    describe("Syntax validation", () => {
        it("no errors", async () => {
            await expectNoValidationErrors(
                TestUtils.createTextMockDocument("(foo as number, bar as number) => foo + bar"),
            );
        });

        it("(foo as number, foo as number) => foo * 2", async () => {
            const errorSource: string = TestConstants.SimpleValidateAllSettings.source;

            const validationResult: ValidationResult = await validate(
                TestUtils.createTextMockDocument(`(foo as number, foo as number) => foo * 2`),
                TestConstants.SimpleLibraryAnalysisSettings,
                TestConstants.SimpleValidateAllSettings,
                undefined,
            );

            expect(validationResult.hasSyntaxError).to.equal(false, "hasSyntaxError flag should be false");

            assertValidationError(validationResult.diagnostics[0], { line: 0, character: 1 });
            assertValidationError(validationResult.diagnostics[1], { line: 0, character: 16 });
            expect(validationResult.diagnostics.length).to.equal(2);
            expect(validationResult.diagnostics[0].source).to.equal(errorSource);
            expect(validationResult.diagnostics[1].source).to.equal(errorSource);
            expect(validationResult.diagnostics[0].code).to.equal(DiagnosticErrorCode.DuplicateIdentifier);
            expect(validationResult.diagnostics[1].code).to.equal(DiagnosticErrorCode.DuplicateIdentifier);
        });
    });
});
