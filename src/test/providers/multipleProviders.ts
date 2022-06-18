// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { TestConstants, TestUtils } from "..";
import { Hover } from "../../powerquery-language-services";

function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, TestConstants.SimpleLibraryAnalysisSettings);
}

describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, () => {
    it(`getHover value in key-value-pair`, async () => {
        const hover: Hover = await createHover(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`);
        TestUtils.assertEqualHover("[library function] Test.SquareIfNumber: (x: any) => any", hover);
    });
});
