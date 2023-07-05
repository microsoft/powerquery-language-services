// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { LanguageConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";
import {
    AbridgedAutocompleteItem,
    expectAbridgedAutocompleteItems,
    expectNoSuggestions,
} from "./autocompleteTestUtils";

describe(`FIXME Inspection - Autocomplete - Language constants`, () => {
    function assertAutocompleteLanguageConstant(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedLanguageConstant);
    }

    function expectNoLanguageConstantSuggestion(textWithPipe: string): Promise<void> {
        return expectNoSuggestions(textWithPipe, assertAutocompleteLanguageConstant);
    }

    async function expectLanguageConstantSuggestion(
        textWithPipe: string,
        expected: ReadonlyArray<AbridgedAutocompleteItem>,
    ): Promise<void> {
        await expectAbridgedAutocompleteItems(textWithPipe, assertAutocompleteLanguageConstant, expected);
    }

    const CatchInsert: AbridgedAutocompleteItem = {
        label: LanguageConstant.Catch,
        isTextEdit: false,
    };

    const CatchReplace: AbridgedAutocompleteItem = {
        label: LanguageConstant.Catch,
        isTextEdit: true,
    };

    const NullableInsert: AbridgedAutocompleteItem = {
        label: LanguageConstant.Nullable,
        isTextEdit: false,
    };

    const NullableReplace: AbridgedAutocompleteItem = {
        label: LanguageConstant.Nullable,
        isTextEdit: true,
    };

    const OptionalInsert: AbridgedAutocompleteItem = {
        label: LanguageConstant.Optional,
        isTextEdit: false,
    };

    const OptionalReplace: AbridgedAutocompleteItem = {
        label: LanguageConstant.Optional,
        isTextEdit: true,
    };

    const OtherwiseInsert: AbridgedAutocompleteItem = {
        label: LanguageConstant.Otherwise,
        isTextEdit: false,
    };

    const OtherwiseReplace: AbridgedAutocompleteItem = {
        label: LanguageConstant.Otherwise,
        isTextEdit: true,
    };

    describe(`${LanguageConstant.Catch}`, () => {
        it(`try 1|`, () => expectNoLanguageConstantSuggestion(`try 1|`));

        it(`try 1 c|`, () => expectLanguageConstantSuggestion(`try 1 c|`, [CatchInsert]));

        it(`try 1 c|`, () => expectLanguageConstantSuggestion(`try 1 c|`, [CatchReplace]));

        it(`try 1 |c`, () => expectLanguageConstantSuggestion(`try 1 |c`, [CatchReplace]));
    });

    describe(`${LanguageConstant.Nullable}`, () => {});

    describe(`${LanguageConstant.Optional}`, () => {});

    describe(`${LanguageConstant.Otherwise}`, () => {});
});
