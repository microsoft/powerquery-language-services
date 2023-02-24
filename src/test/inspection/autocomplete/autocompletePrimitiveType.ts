// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { Assert } from "@microsoft/powerquery-parser";
import { Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

async function assertContainsPrimitiveTypeAutocomplete(
    textWithPosition: string,
    expected: ReadonlyArray<PrimitiveTypeConstant>,
): Promise<void> {
    const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPosition);

    const actual: Inspection.Autocomplete = await TestUtils.assertGetAutocomplete(
        TestConstants.DefaultInspectionSettings,
        text,
        position,
    );

    Assert.isOk(actual.triedPrimitiveType);

    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedPrimitiveType.value);
}

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it(`type|`, () => assertContainsPrimitiveTypeAutocomplete(`type|`, []));

    it(`type |`, () => assertContainsPrimitiveTypeAutocomplete(`type |`, PrimitiveTypeConstants));

    it(`let x = type|`, () => assertContainsPrimitiveTypeAutocomplete(`let x = type|`, []));

    it(`let x = type |`, () => assertContainsPrimitiveTypeAutocomplete(`let x = type |`, PrimitiveTypeConstants));

    it(`type | number`, () => assertContainsPrimitiveTypeAutocomplete(`type | number`, PrimitiveTypeConstants));

    it(`type n|`, () =>
        assertContainsPrimitiveTypeAutocomplete(`type n|`, [
            Constant.PrimitiveTypeConstant.None,
            Constant.PrimitiveTypeConstant.Null,
            Constant.PrimitiveTypeConstant.Number,
        ]));

    it(`(x|) => 1`, () => assertContainsPrimitiveTypeAutocomplete(`(x|) => 1`, []));

    it(`(x as| number) => 1`, () => assertContainsPrimitiveTypeAutocomplete(`(x as| number) => 1`, []));

    it(`(x as | number) => 1`, () =>
        assertContainsPrimitiveTypeAutocomplete(`(x as | number) => 1`, PrimitiveTypeConstants));

    it(`(x as| nullable number) => 1`, () =>
        assertContainsPrimitiveTypeAutocomplete(`(x as| nullable number) => 1`, []));

    it(`(x as | nullable number) => 1`, () =>
        assertContainsPrimitiveTypeAutocomplete(`(x as | nullable number) => 1`, PrimitiveTypeConstants));

    it(`(x as nullable| number) => 1`, () =>
        assertContainsPrimitiveTypeAutocomplete(`(x as nullable| number) => 1`, []));

    it(`(x as nullable num|ber) => 1`, () =>
        assertContainsPrimitiveTypeAutocomplete(`(x as nullable num|ber) => 1`, PrimitiveTypeConstants));

    it(`let a = 1 is |`, () => assertContainsPrimitiveTypeAutocomplete(`let a = 1 is |`, PrimitiveTypeConstants));
});
