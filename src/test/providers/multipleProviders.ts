// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { TestConstants, TestUtils } from "..";
import { Hover } from "../../powerquery-language-services";

async function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, TestConstants.SimpleLibraryAnalysisSettings);
}
describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, async () => {
    it(`getHover value in key-value-pair`, async () => {
        const hover: Hover = await createHover(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`);
        TestUtils.assertHover("[library function] Test.SquareIfNumber: (x: any) => any", hover);
    });
});
