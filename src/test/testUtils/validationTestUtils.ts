// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { MockDocument } from "../mockDocument";

export async function expectLessWhenSurpressed(params: {
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

export async function assertValidateDiagnostics(params: {
    readonly text: string;
    readonly analysisSettings: PQLS.AnalysisSettings;
    readonly validationSettings: PQLS.ValidationSettings;
}): Promise<PQLS.Diagnostic[]> {
    return (await assertValidate(params)).diagnostics;
}
