// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";

export async function expectLessWhenSurpressed(params: {
    readonly text: string;
    readonly withCheckSettings: PQLS.ValidationSettings;
    readonly withoutCheckSettings: PQLS.ValidationSettings;
}): Promise<void> {
    const withCheckResult: PQLS.ValidateOk = await TestUtils.assertValidate({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: params.withCheckSettings,
    });

    const withoutCheckResult: PQLS.ValidateOk = await TestUtils.assertValidate({
        text: params.text,
        analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
        validationSettings: params.withoutCheckSettings,
    });

    expect(withoutCheckResult.diagnostics.length).to.be.lessThan(withCheckResult.diagnostics.length);
}
