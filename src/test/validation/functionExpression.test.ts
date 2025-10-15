// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";

import {
    type Diagnostic,
    DiagnosticErrorCode,
    DiagnosticSeverity,
    type Position,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { type ValidateOk } from "../../powerquery-language-services/validate/validateOk";

function assertValidationError(diagnostic: Diagnostic, startPosition: Position): void {
    if (diagnostic.code === undefined) {
        throw new Error("diagnostic.code is undefined");
    }

    if (diagnostic.message === undefined) {
        throw new Error("diagnostic.message is undefined");
    }

    if (diagnostic.range === undefined) {
        throw new Error("diagnostic.range is undefined");
    }

    expect(diagnostic.range.start).toEqual(startPosition);
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
}

async function assertNoValidationErrors(text: string): Promise<void> {
    const validationResult: ValidateOk = await TestUtils.assertValidate({
        text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: TestConstants.SimpleLibraryValidateAllSettings,
    });

    expect(validationResult.hasSyntaxError).toBe(false); // hasSyntaxError flag should be false
    expect(validationResult.diagnostics.length).toBe(0); // no diagnostics expected
}

describe(`Validation - functionExpression`, () => {
    describe(`Syntax validation`, () => {
        it(`no errors`, async () => {
            await assertNoValidationErrors(`(foo as number, bar as number) => foo + bar`);
        });

        it(`(foo as number, foo as number) => foo * 2`, async () => {
            const errorSource: string = TestConstants.SimpleLibraryValidateAllSettings.source;

            const validationResult: ValidateOk = await TestUtils.assertValidate({
                text: `(foo as number, foo as number) => foo * 2`,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                validationSettings: TestConstants.SimpleLibraryValidateAllSettings,
            });

            expect(validationResult.hasSyntaxError).toBe(false); // hasSyntaxError flag should be false

            assertValidationError(validationResult.diagnostics[0], { line: 0, character: 1 });
            assertValidationError(validationResult.diagnostics[1], { line: 0, character: 16 });
            expect(validationResult.diagnostics.length).toBe(2);
            expect(validationResult.diagnostics[0].source).toBe(errorSource);
            expect(validationResult.diagnostics[1].source).toBe(errorSource);
            expect(validationResult.diagnostics[0].code).toBe(DiagnosticErrorCode.DuplicateIdentifier);
            expect(validationResult.diagnostics[1].code).toBe(DiagnosticErrorCode.DuplicateIdentifier);
        });
    });
});
