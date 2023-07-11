// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { LanguageConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { ResultUtils } from "@microsoft/powerquery-parser";

import {
    AbridgedAutocompleteItem,
    expectAbridgedAutocompleteItems,
    expectNoSuggestions,
} from "./autocompleteTestUtils";
import { Inspection } from "../../../powerquery-language-services";

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
        expected: AbridgedAutocompleteItem,
    ): Promise<void> {
        await expectAbridgedAutocompleteItems(textWithPipe, assertAutocompleteLanguageConstant, [expected]);
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

    describe(`${LanguageConstant.Catch}`, () => {
        it(`try 1|`, () => expectNoLanguageConstantSuggestion(`try 1|`));

        it(`try 1|`, () => expectLanguageConstantSuggestion(`try 1 |`, CatchInsert));

        it(`try 1 c|`, () => expectLanguageConstantSuggestion(`try 1 c|`, CatchReplace));

        it(`try 1 |c`, () => expectLanguageConstantSuggestion(`try 1 |c`, CatchReplace));
    });

    describe(`${LanguageConstant.Nullable}`, () => {
        it(`a as|`, () => expectNoLanguageConstantSuggestion(`a as|`));

        it(`a as |`, () => expectLanguageConstantSuggestion(`a as |`, NullableInsert));

        it(`a as |n`, () => expectLanguageConstantSuggestion(`a as |n`, NullableReplace));

        it(`a as n|`, () => expectLanguageConstantSuggestion(`a as n|`, NullableReplace));

        it(`a as n |`, () => expectNoLanguageConstantSuggestion(`a as n |`));

        it(`(a as |`, () => expectLanguageConstantSuggestion(`(a as |`, NullableInsert));

        it(`(a as n|`, () => expectLanguageConstantSuggestion(`(a as n|`, NullableReplace));

        it(`(a as |n`, () => expectLanguageConstantSuggestion(`(a as |n`, NullableReplace));

        it(`(a as n |`, () => expectNoLanguageConstantSuggestion(`(a as n |`));
    });

    describe(`${LanguageConstant.Optional}`, () => {
        it(`(x, |`, () => expectLanguageConstantSuggestion(`(x, |`, OptionalInsert));

        it(`(x, |opt`, () => expectLanguageConstantSuggestion(`(x, |opt`, OptionalReplace));

        it(`(x, opt|`, () => expectLanguageConstantSuggestion(`(x, opt|`, OptionalReplace));

        it(`(x, opt |`, () => expectNoLanguageConstantSuggestion(`(x, opt |`));

        it(`(x, optional|`, () => expectLanguageConstantSuggestion(`(x, optional|`, OptionalReplace));

        it(`(x, optional |`, () => expectNoLanguageConstantSuggestion(`(x, optional |`));
    });
});
