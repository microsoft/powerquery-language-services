// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { MockDocument } from "../mockDocument";

export async function assertLessWhenSuppressed(params: {
    readonly text: string;
    readonly withCheckSettings: PQLS.ValidationSettings;
    readonly withoutCheckSettings: PQLS.ValidationSettings;
}): Promise<void> {
    const withCheckResult: PQLS.ValidateOk = await assertValidate({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: params.withCheckSettings,
    });

    const withoutCheckResult: PQLS.ValidateOk = await assertValidate({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: params.withoutCheckSettings,
    });

    expect(withoutCheckResult.diagnostics.length).to.be.lessThan(withCheckResult.diagnostics.length);
}

export async function assertValidate(params: {
    readonly text: string;
    readonly analysisSettings: PQLS.AnalysisSettings;
    readonly validationSettings: PQLS.ValidationSettings;
}): Promise<PQLS.ValidateOk> {
    const mockDocument: MockDocument = TestUtils.mockDocument(params.text);

    const triedValidation: Result<PQLS.ValidateOk | undefined, CommonError.CommonError> = await PQLS.validate(
        mockDocument,
        params.analysisSettings,
        params.validationSettings,
    );

    ResultUtils.assertIsOk(triedValidation);
    Assert.isDefined(triedValidation.value);

    return triedValidation.value;
}

/**
 * Asserts that a validation result is an error and that the error message contains the expected text.
 */
export function assertValidationError(
    result: Result<any, CommonError.CommonError>,
    expectedMessageContains: string,
    assertionMessage?: string,
): void {
    const message: string =
        assertionMessage ?? `Expected validation to return error containing '${expectedMessageContains}'`;

    expect(ResultUtils.isError(result), message).to.be.true;

    if (ResultUtils.isError(result)) {
        expect(result.error.message).to.contain(expectedMessageContains);
    }
}

/**
 * Asserts that a validation result is an error caused by cancellation.
 */
export function assertValidationCancelled(
    result: Result<any, CommonError.CommonError>,
    assertionMessage?: string,
): void {
    assertValidationError(
        result,
        "cancelled",
        assertionMessage ?? "Expected validation to return error due to cancellation",
    );
}

/**
 * Asserts that a validation result is successful (not an error).
 */
export function assertValidationSuccess(result: Result<any, CommonError.CommonError>, assertionMessage?: string): void {
    const message: string = assertionMessage ?? "Expected validation to succeed";
    expect(ResultUtils.isOk(result), message).to.be.true;
}

/**
 * Handles validation results that could be either successful or cancelled due to timing.
 * This is useful for tests where cancellation timing is non-deterministic.
 */
export function assertValidationSuccessOrCancelled(
    result: Result<any, CommonError.CommonError>,
    onSuccess?: () => void,
    onCancelled?: () => void,
): void {
    if (ResultUtils.isOk(result)) {
        // Validation completed successfully
        expect(result.value).to.not.be.undefined;
        onSuccess?.();
    } else {
        // Expect cancellation error
        expect(result.error.message).to.contain("cancelled");
        onCancelled?.();
    }
}

export async function assertValidateDiagnostics(params: {
    readonly text: string;
    readonly analysisSettings: PQLS.AnalysisSettings;
    readonly validationSettings: PQLS.ValidationSettings;
}): Promise<PQLS.Diagnostic[]> {
    return (await assertValidate(params)).diagnostics;
}
