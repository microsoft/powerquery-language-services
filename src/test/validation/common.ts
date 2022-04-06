// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as PQLS from "../../powerquery-language-services";
import { TestUtils } from "..";

export async function expectLessWhenSurpressed(
    text: string,
    withCheckSettings: PQLS.ValidationSettings,
    withoutCheckSettings: PQLS.ValidationSettings,
): Promise<void> {
    const textDocument: PQLS.TextDocument = TestUtils.createTextMockDocument(text);

    const withCheckResult: PQLS.ValidationResult = await PQLS.validate(textDocument, withCheckSettings);

    const withoutCheckResult: PQLS.ValidationResult = await PQLS.validate(textDocument, withoutCheckSettings);

    expect(withoutCheckResult.diagnostics.length).to.be.lessThan(withCheckResult.diagnostics.length);
}
