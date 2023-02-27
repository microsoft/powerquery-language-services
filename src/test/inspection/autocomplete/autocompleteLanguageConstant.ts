// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { LanguageConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - Language constants`, () => {
    async function runTest(textWithPipe: string, expected: LanguageConstant | undefined): Promise<void> {
        const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
            TestConstants.DefaultInspectionSettings,
            textWithPipe,
        );

        ResultUtils.assertIsOk(actual.triedLanguageConstant);

        TestUtils.assertContainsAutocompleteItemLabels(
            expected ? [expected] : [],
            actual.triedLanguageConstant.value ? [actual.triedLanguageConstant.value] : [],
        );
    }

    describe(`${LanguageConstant.Catch}`, () => {
        it(`try 1|`, () => runTest(`try 1|`, undefined));

        it(`try 1 |`, () => runTest(`try 1 |`, LanguageConstant.Catch));

        it(`try 1 c|`, () => runTest(`try 1 c|`, LanguageConstant.Catch));

        it(`try 1 + 1 c|`, () => runTest(`try 1 + 1 c|`, LanguageConstant.Catch));

        it(`try 1 + 1 |`, () => runTest(`try 1 + 1 |`, LanguageConstant.Catch));

        it(`try 1 + 1 o|`, () => runTest(`try 1 + 1 o|`, undefined));
    });

    describe(`${LanguageConstant.Nullable}`, () => {
        it(`a as |`, () => runTest(`a as |`, LanguageConstant.Nullable));

        it(`a as n|`, () => runTest(`a as n|`, LanguageConstant.Nullable));

        it(`(a as |`, () => runTest(`(a as |`, LanguageConstant.Nullable));

        it(`(a as n|`, () => runTest(`(a as n|`, LanguageConstant.Nullable));
    });

    describe(`${LanguageConstant.Optional}`, () => {
        it(`(x, |`, () => runTest(`(x, |`, LanguageConstant.Optional));

        it(`(x, op|`, () => runTest(`(x, op|`, LanguageConstant.Optional));
    });
});
