// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { LanguageConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { Inspection } from "../../../powerquery-language-services";
import { TestUtils } from "../..";

describe(`Inspection - Autocomplete - Language constants`, () => {
    function assertAutocompleteLanguageConstant(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedLanguageConstant);
    }

    async function expectNoLanguageConstantSuggestion(textWithPipe: string): Promise<void> {
        await TestUtils.expectNoSuggestions({
            textWithPipe,
            autocompleteItemSelector: assertAutocompleteLanguageConstant,
        });
    }

    async function expectLanguageConstantSuggestion(
        textWithPipe: string,
        expected: TestUtils.AbridgedAutocompleteItem,
    ): Promise<void> {
        await TestUtils.expectSuggestions({
            textWithPipe,
            autocompleteItemSelector: assertAutocompleteLanguageConstant,
            expected: [expected],
        });
    }

    const CatchInsert: TestUtils.AbridgedAutocompleteItem = {
        label: LanguageConstant.Catch,
        isTextEdit: false,
    };

    const CatchReplace: TestUtils.AbridgedAutocompleteItem = {
        label: LanguageConstant.Catch,
        isTextEdit: true,
    };

    const NullableInsert: TestUtils.AbridgedAutocompleteItem = {
        label: LanguageConstant.Nullable,
        isTextEdit: false,
    };

    const NullableReplace: TestUtils.AbridgedAutocompleteItem = {
        label: LanguageConstant.Nullable,
        isTextEdit: true,
    };

    const OptionalInsert: TestUtils.AbridgedAutocompleteItem = {
        label: LanguageConstant.Optional,
        isTextEdit: false,
    };

    const OptionalReplace: TestUtils.AbridgedAutocompleteItem = {
        label: LanguageConstant.Optional,
        isTextEdit: true,
    };

    describe(`${LanguageConstant.Catch}`, () => {
        it(`try | 1`, async () => await expectNoLanguageConstantSuggestion(`try | 1`));

        it(`try 1|`, async () => await expectNoLanguageConstantSuggestion(`try 1|`));

        it(`try 1 |`, async () => await expectLanguageConstantSuggestion(`try 1 |`, CatchInsert));

        it(`try 1 c|`, async () => await expectLanguageConstantSuggestion(`try 1 c|`, CatchReplace));

        it(`try 1 |c`, async () => await expectLanguageConstantSuggestion(`try 1 |c`, CatchReplace));

        it(`try 1 |catch`, async () => await expectLanguageConstantSuggestion(`try 1 |catch`, CatchReplace));

        it(`try 1 catch|`, async () => await expectLanguageConstantSuggestion(`try 1 catch|`, CatchReplace));

        it(`try 1 c |`, async () => await expectNoLanguageConstantSuggestion(`try 1 c |`));

        it(`try 1 | c`, async () => await expectNoLanguageConstantSuggestion(`try 1 | c`));

        it(`try 1 |catch (foo) => 1`, async () =>
            await expectLanguageConstantSuggestion(`try 1 |catch (foo) => 1`, CatchReplace));

        it(`try 1 catch| (foo) => 1`, async () =>
            await expectLanguageConstantSuggestion(`try 1 catch| (foo) => 1`, CatchReplace));

        it(`try 1 | catch (foo) => 1`, async () =>
            await expectNoLanguageConstantSuggestion(`try 1 | catch (foo) => 1`));

        it(`try 1 catch | (foo) => 1`, async () =>
            await expectNoLanguageConstantSuggestion(`try 1 catch | (foo) => 1`));

        it(`try 1 otherwise| 1`, async () =>
            await expectLanguageConstantSuggestion(`try 1 otherwise| 1`, CatchReplace));

        it(`try 1 |otherwise 1`, async () =>
            await expectLanguageConstantSuggestion(`try 1 |otherwise 1`, CatchReplace));

        it(`try 1 | otherwise 1`, async () => await expectNoLanguageConstantSuggestion(`try 1 | otherwise 1`));

        it(`try 1 otherwise | 1`, async () => await expectNoLanguageConstantSuggestion(`try 1 otherwise | 1`));

        it(`try 1 otherwise|`, async () => await expectLanguageConstantSuggestion(`try 1 otherwise|`, CatchReplace));

        it(`try 1 |otherwise`, async () => await expectLanguageConstantSuggestion(`try 1 |otherwise`, CatchReplace));

        it(`try 1 | otherwise`, async () => await expectNoLanguageConstantSuggestion(`try 1 | otherwise`));

        it(`try 1 otherwise |`, async () => await expectNoLanguageConstantSuggestion(`try 1 otherwise |`));
    });

    describe(`${LanguageConstant.Nullable}`, () => {
        it(`a as|`, async () => await expectNoLanguageConstantSuggestion(`a as|`));

        it(`a as |`, async () => await expectLanguageConstantSuggestion(`a as |`, NullableInsert));

        it(`a as |n`, async () => await expectLanguageConstantSuggestion(`a as |n`, NullableReplace));

        it(`a as n|`, async () => await expectLanguageConstantSuggestion(`a as n|`, NullableReplace));

        it(`a as n |`, async () => await expectNoLanguageConstantSuggestion(`a as n |`));

        it(`a as | n`, async () => await expectNoLanguageConstantSuggestion(`a as | n`));

        it(`(a as |`, async () => await expectLanguageConstantSuggestion(`(a as |`, NullableInsert));

        it(`(a as n|`, async () => await expectLanguageConstantSuggestion(`(a as n|`, NullableReplace));

        it(`(a as |n`, async () => await expectLanguageConstantSuggestion(`(a as |n`, NullableReplace));

        it(`(a as n |`, async () => await expectNoLanguageConstantSuggestion(`(a as n |`));

        it(`(a as | n`, async () => await expectNoLanguageConstantSuggestion(`(a as | n`));
    });

    describe(`${LanguageConstant.Optional}`, () => {
        it(`(x, |`, async () => await expectLanguageConstantSuggestion(`(x, |`, OptionalInsert));

        it(`(x, |opt`, async () => await expectLanguageConstantSuggestion(`(x, |opt`, OptionalReplace));

        it(`(x, opt|`, async () => await expectLanguageConstantSuggestion(`(x, opt|`, OptionalReplace));

        it(`(x, | opt`, async () => await expectNoLanguageConstantSuggestion(`(x, |`));

        it(`(x, opt |`, async () => await expectNoLanguageConstantSuggestion(`(x, opt |`));

        it(`(x, optional|`, async () => await expectLanguageConstantSuggestion(`(x, optional|`, OptionalReplace));

        it(`(x, optional |`, async () => await expectNoLanguageConstantSuggestion(`(x, optional |`));
    });
});
