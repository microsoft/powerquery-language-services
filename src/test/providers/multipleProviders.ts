// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "..";
import { Hover } from "../../powerquery-language-services";

function createHover(text: string): Promise<Result<Hover | undefined, CommonError.CommonError>> {
    return TestUtils.createHover(text, TestConstants.SimpleLibraryAnalysisSettings);
}

describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, () => {
    it(`getHover value in key-value-pair`, async () => {
        const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
            `let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`,
        );

        Assert.isOk(hover);
        Assert.isDefined(hover.value);
        TestUtils.assertEqualHover("[library function] Test.SquareIfNumber: (x: any) => any", hover.value);
    });
});
