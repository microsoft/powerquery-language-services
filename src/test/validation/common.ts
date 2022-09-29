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
    const textDocument: PQLS.TextDocument = TestUtils.createTextMockDocument(text);

    const withCheckResult: PQLS.ValidateOk = await TestUtils.assertGetValidateOk(
        textDocument,
        TestConstants.SimpleLibraryAnalysisSettings,
        withCheckSettings,
    );

    const withoutCheckResult: PQLS.ValidateOk = await TestUtils.assertGetValidateOk(
        textDocument,
        TestConstants.SimpleLibraryAnalysisSettings,
        withoutCheckSettings,
    );

    expect(withoutCheckResult.diagnostics.length).to.be.lessThan(withCheckResult.diagnostics.length);
}
