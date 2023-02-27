// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";

import { Diagnostic, DiagnosticErrorCode, DiagnosticSeverity, Position } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";

function assertValidationError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

async function assertNoValidationErrors(text: string): Promise<void> {
    const validationResult: ValidateOk = await TestUtils.assertValidate(
        TestConstants.SimpleLibraryAnalysisSettings,
        TestConstants.SimpleValidateAllSettings,
        text,
    );

    expect(validationResult.hasSyntaxError).to.equal(false, `hasSyntaxError flag should be false`);
    expect(validationResult.diagnostics.length).to.equal(0, `no diagnostics expected`);
}

describe(`Validation - functionExpression`, () => {
    describe(`Syntax validation`, () => {
        it(`no errors`, async () => {
            await assertNoValidationErrors(`(foo as number, bar as number) => foo + bar`);
        });

        it(`(foo as number, foo as number) => foo * 2`, async () => {
            const errorSource: string = TestConstants.SimpleValidateAllSettings.source;

            const validationResult: ValidateOk = await TestUtils.assertValidate(
                TestConstants.SimpleLibraryAnalysisSettings,
                TestConstants.SimpleValidateAllSettings,
                `(foo as number, foo as number) => foo * 2`,
            );

            expect(validationResult.hasSyntaxError).to.equal(false, `hasSyntaxError flag should be false`);

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
