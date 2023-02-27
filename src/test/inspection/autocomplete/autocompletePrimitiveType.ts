// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    async function runTest(textWithPipe: string, expected: ReadonlyArray<PrimitiveTypeConstant>): Promise<void> {
        const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
            TestConstants.DefaultInspectionSettings,
            textWithPipe,
        );

        ResultUtils.assertIsOk(actual.triedPrimitiveType);

        TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedPrimitiveType.value);
    }

    it(`type|`, () => runTest(`type|`, []));

    it(`type |`, () => runTest(`type |`, PrimitiveTypeConstants));

    it(`let x = type|`, () => runTest(`let x = type|`, []));

    it(`let x = type |`, () => runTest(`let x = type |`, PrimitiveTypeConstants));

    it(`type | number`, () => runTest(`type | number`, PrimitiveTypeConstants));

    it(`type n|`, () =>
        runTest(`type n|`, [
            Constant.PrimitiveTypeConstant.None,
            Constant.PrimitiveTypeConstant.Null,
            Constant.PrimitiveTypeConstant.Number,
        ]));

    it(`(x|) => 1`, () => runTest(`(x|) => 1`, []));

    it(`(x as| number) => 1`, () => runTest(`(x as| number) => 1`, []));

    it(`(x as | number) => 1`, () => runTest(`(x as | number) => 1`, PrimitiveTypeConstants));

    it(`(x as| nullable number) => 1`, () => runTest(`(x as| nullable number) => 1`, []));

    it(`(x as | nullable number) => 1`, () => runTest(`(x as | nullable number) => 1`, PrimitiveTypeConstants));

    it(`(x as nullable| number) => 1`, () => runTest(`(x as nullable| number) => 1`, []));

    it(`(x as nullable num|ber) => 1`, () => runTest(`(x as nullable num|ber) => 1`, PrimitiveTypeConstants));

    it(`let a = 1 is |`, () => runTest(`let a = 1 is |`, PrimitiveTypeConstants));
});
