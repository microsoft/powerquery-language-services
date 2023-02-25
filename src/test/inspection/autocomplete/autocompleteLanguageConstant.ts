// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import { LanguageConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

async function assertContainsLanguageConstantAutocomplete(
    textWithPipe: string,
    expected: LanguageConstant | undefined,
): Promise<void> {
    const actual: Inspection.Autocomplete = await TestUtils.assertAutocomplete(
        TestConstants.DefaultInspectionSettings,
        textWithPipe,
    );

    Assert.isOk(actual.triedLanguageConstant);

    TestUtils.assertContainsAutocompleteItemLabels(
        expected ? [expected] : [],
        actual.triedLanguageConstant.value ? [actual.triedLanguageConstant.value] : [],
    );
}

describe(`Inspection - Autocomplete - Language constants`, () => {
    describe(`${LanguageConstant.Catch}`, () => {
        it(`try 1|`, () => assertContainsLanguageConstantAutocomplete(`try 1|`, undefined));

        it(`try 1 |`, () => assertContainsLanguageConstantAutocomplete(`try 1 |`, LanguageConstant.Catch));

        it(`try 1 c|`, () => assertContainsLanguageConstantAutocomplete(`try 1 c|`, LanguageConstant.Catch));

        it(`try 1 + 1 c|`, () => assertContainsLanguageConstantAutocomplete(`try 1 + 1 c|`, LanguageConstant.Catch));

        it(`try 1 + 1 |`, () => assertContainsLanguageConstantAutocomplete(`try 1 + 1 |`, LanguageConstant.Catch));

        it(`try 1 + 1 o|`, () => assertContainsLanguageConstantAutocomplete(`try 1 + 1 o|`, undefined));
    });

    describe(`${LanguageConstant.Nullable}`, () => {
        it(`a as |`, () => assertContainsLanguageConstantAutocomplete(`a as |`, LanguageConstant.Nullable));

        it(`a as n|`, () => assertContainsLanguageConstantAutocomplete(`a as n|`, LanguageConstant.Nullable));

        it(`(a as |`, () => assertContainsLanguageConstantAutocomplete(`(a as |`, LanguageConstant.Nullable));

        it(`(a as n|`, () => assertContainsLanguageConstantAutocomplete(`(a as n|`, LanguageConstant.Nullable));
    });

    describe(`${LanguageConstant.Optional}`, () => {
        it(`(x, |`, () => assertContainsLanguageConstantAutocomplete(`(x, |`, LanguageConstant.Optional));

        it(`(x, op|`, () => assertContainsLanguageConstantAutocomplete(`(x, op|`, LanguageConstant.Optional));
    });
});
