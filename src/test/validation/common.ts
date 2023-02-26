// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";

export async function expectLessWhenSurpressed(
    text: string,
    withCheckSettings: PQLS.ValidationSettings,
    withoutCheckSettings: PQLS.ValidationSettings,
): Promise<void> {
    const withCheckResult: PQLS.ValidateOk = await TestUtils.assertValidate(
        TestConstants.SimpleLibraryAnalysisSettings,
        withCheckSettings,
        text,
    );

    const withoutCheckResult: PQLS.ValidateOk = await TestUtils.assertValidate(
        TestConstants.SimpleLibraryAnalysisSettings,
        withoutCheckSettings,
        text,
    );

    expect(withoutCheckResult.diagnostics.length).to.be.lessThan(withCheckResult.diagnostics.length);
}
