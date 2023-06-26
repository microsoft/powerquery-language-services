// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { ArrayUtils, Assert, ResultUtils } from "@microsoft/powerquery-parser";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { expect } from "chai";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    describe(`AutocompleteItem.label`, () => {
        async function expectAutocompleteItems(
            textWithPipe: string,
            isTextEditExpected: boolean | undefined,
        ): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
            const autocomplete: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
                TestConstants.DefaultInspectionSettings,
                textWithPipe,
            );

            ResultUtils.assertIsOk(autocomplete.triedPrimitiveType);
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = autocomplete.triedPrimitiveType.value;

            if (isTextEditExpected !== undefined) {
                const hasTextEdit: ReadonlyArray<boolean> = actual.map(
                    (autocompleteItem: Inspection.AutocompleteItem) => autocompleteItem.textEdit !== undefined,
                );

                Assert.isTrue(
                    ArrayUtils.all(hasTextEdit, (value: boolean) =>
                        isTextEditExpected ? value === true : value === false,
                    ),
                    isTextEditExpected ? "expected textEdit to be defined" : "expected textEdit to be undefined",
                    {
                        isTextEditExpected,
                        hasTextEdit,
                    },
                );
            }

            return actual;
        }

        async function expectNoSuggestions(textWithPipe: string): Promise<void> {
            const autocompleteItems: ReadonlyArray<Inspection.AutocompleteItem> = await expectAutocompleteItems(
                textWithPipe,
                undefined,
            );

            expect(autocompleteItems.length).to.equal(0);
        }

        async function expectInserts(textWithPipe: string): Promise<void> {
            const autocompleteItems: ReadonlyArray<Inspection.AutocompleteItem> = await expectAutocompleteItems(
                textWithPipe,
                false,
            );

            const partialMatches: ReadonlyArray<Inspection.AutocompleteItem> = autocompleteItems.filter(
                (autocompleteItem: Inspection.AutocompleteItem) => autocompleteItem.jaroWinklerScore !== 1,
            );

            expect(partialMatches.length).to.equal(0);
        }

        async function expectDatePrimitiveTypeReplacements(textWithPipe: string): Promise<void> {
            const autocompleteItems: ReadonlyArray<Inspection.AutocompleteItem> = await expectAutocompleteItems(
                textWithPipe,
                true,
            );

            const top3Labels: ReadonlyArray<string> = Array.from(autocompleteItems)
                .sort(
                    (left: Inspection.AutocompleteItem, right: Inspection.AutocompleteItem) =>
                        right.jaroWinklerScore - left.jaroWinklerScore,
                )
                .slice(0, 3)
                .map((autocompleteItem: Inspection.AutocompleteItem) => autocompleteItem.label)
                .sort();

            expect(top3Labels).to.deep.equal(DatePrimitiveTypeConstants);
        }

        const AllowedPrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = PrimitiveTypeConstants.filter(
            (constant: PrimitiveTypeConstant) => constant !== PrimitiveTypeConstant.None,
        );

        const DatePrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = AllowedPrimitiveTypeConstants.filter(
            (value: PrimitiveTypeConstant) => value.includes("date"),
        ).sort();

        it(`|`, () => expectNoSuggestions(`|`));

        it(`if |`, () => expectNoSuggestions(`if |`));

        it(`type|`, () => expectNoSuggestions(`type|`));

        it(`| type`, () => expectNoSuggestions(`| type`));

        it(`type |`, () => expectInserts(`type |`));

        it(`type |date`, () => expectDatePrimitiveTypeReplacements(`type |date`));

        it(`type date|`, () => expectDatePrimitiveTypeReplacements(`type date|`));

        it(`type date |`, () => expectNoSuggestions(`type date |`));

        it(`| let x = type`, () => expectNoSuggestions(`| let x = type`));

        it(`let x = type|`, () => expectNoSuggestions(`let x = type|`));

        it(`let x = type |`, () => expectInserts(`let x = type |`));

        it(`type | number`, () => expectNoSuggestions(`type | number`));

        it(`type nullable|`, () => expectNoSuggestions(`type nullable|`));

        it(`type nullable |`, () => expectInserts(`type nullable |`));

        it(`type nullable date|`, () => expectDatePrimitiveTypeReplacements(`type nullable date|`));

        it(`type nullable |date`, () => expectDatePrimitiveTypeReplacements(`type nullable |date`));

        it(`type {|`, () => expectInserts(`type {|`));

        it(`type { date|`, () => expectDatePrimitiveTypeReplacements(`type { date|`));

        it(`type { |date`, () => expectDatePrimitiveTypeReplacements(`type { |date`));

        it(`type { | date`, () => expectNoSuggestions(`type { | date`));

        it(`type { date | `, () => expectNoSuggestions(`type { date | `));

        it(`type { date | } `, () => expectNoSuggestions(`type { date | } `));

        it(`type {date|}`, () => expectDatePrimitiveTypeReplacements(`type {date|}`));

        it(`type {|date}`, () => expectDatePrimitiveTypeReplacements(`type {|date}`));

        it(`type [x =|`, () => expectInserts(`type [x =|`));

        it(`type [x = |`, () => expectInserts(`type [x = |`));

        it(`type [x =|]`, () => expectInserts(`type [x =|]`));

        it(`type [x = |]`, () => expectInserts(`type [x = |]`));

        it(`type [x = | ]`, () => expectInserts(`type [x = | ]`));

        it(`type [x = date|`, () => expectDatePrimitiveTypeReplacements(`type [x = date|`));

        it(`type [x = |date`, () => expectDatePrimitiveTypeReplacements(`type [x = |date`));

        it(`type function (val as |date) as date`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as |date) as date`));

        it(`type function (val as date|) as date`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as date|) as date`));

        it(`type function (val as date) as |date`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as date) as |date`));

        it(`type function (val as date) as date|`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as date) as date|`));

        it(`type function (val as date|) as date`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as date|) as date`));

        it(`type function (val as date| ) as date`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as date| ) as date`));

        it(`type function (val as |date) as date`, () =>
            expectDatePrimitiveTypeReplacements(`type function (val as |date) as date`));

        it(`type function (val as n |) as date`, () => expectNoSuggestions(`type function (val as n |) as date`));

        it(`type function (val as | n) as date`, () => expectNoSuggestions(`type function (val as | n) as date`));

        it(`type function (val as date) as date |`, () => expectNoSuggestions(`type function (val as date) as date |`));

        it(`type function (val as date) as | date`, () => expectNoSuggestions(`type function (val as date) as | date`));

        it(`type table [x =|`, () => expectInserts(`type table [x =|`));

        it(`type table [x = |`, () => expectInserts(`type table [x = |`));

        it(`type table [x =|]`, () => expectInserts(`type table [x =|]`));

        it(`type table [x = |]`, () => expectInserts(`type table [x = |]`));

        it(`type table [x = | ]`, () => expectInserts(`type table [x = | ]`));

        it(`type table [x = date|`, () => expectDatePrimitiveTypeReplacements(`type table [x = date|`));

        it(`type table [x = |date`, () => expectDatePrimitiveTypeReplacements(`type table [x = |date`));

        it(`(x|) => 1`, () => expectNoSuggestions(`(x|) => 1`));

        it(`(x |) => 1`, () => expectNoSuggestions(`(x |) => 1`));

        it(`(x as|) => 1`, () => expectNoSuggestions(`(x as|) => 1`));

        it(`(x as |) => 1`, () => expectInserts(`(x as |) => 1`));

        it(`(x as | ) => 1`, () => expectInserts(`(x as | ) => 1`));

        it(`(x as date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as date|) => 1`));

        it(`(x as date |) => 1`, () => expectNoSuggestions(`(x as date |) => 1`));

        it(`(x as date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as date|) => 1`));

        it(`(x as date| ) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as date| ) => 1`));

        it(`(x as nullable|) => 1`, () => expectNoSuggestions(`(x as nullable|) => 1`));

        it(`(x as nullable |) => 1`, () => expectInserts(`(x as nullable |) => 1`));

        it(`(x as nullable date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as nullable date|) => 1`));

        it(`(x as nullable |date) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as nullable |date) => 1`));

        it(`(x as nullable date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as nullable date|) => 1`));

        it(`(x as nullable date |) => 1`, () => expectNoSuggestions(`(x as nullable date |) => 1`));

        it(`1 as|`, () => expectNoSuggestions(`1 as|`));

        it(`1 as |`, () => expectInserts(`1 as |`));

        it(`| 1 as`, () => expectNoSuggestions(`| 1 as`));

        it(`1 as date|`, () => expectDatePrimitiveTypeReplacements(`1 as date|`));

        it(`1 as |date`, () => expectDatePrimitiveTypeReplacements(`1 as |date`));

        it(`1 as date| as logical`, () => expectDatePrimitiveTypeReplacements(`1 as date| as logical`));

        it(`1 as date | as logical`, () => expectNoSuggestions(`1 as date | as logical`));

        it(`1 as da |`, () => expectNoSuggestions(`1 as da |`));

        it(`1 is|`, () => expectNoSuggestions(`1 is|`));

        it(`1 is |`, () => expectInserts(`1 is |`));

        it(`| 1 is`, () => expectNoSuggestions(`| 1 is`));

        it(`1 is date|`, () => expectDatePrimitiveTypeReplacements(`1 is date|`));

        it(`1 is |date`, () => expectDatePrimitiveTypeReplacements(`1 is |date`));

        it(`1 is date| is logical`, () => expectDatePrimitiveTypeReplacements(`1 is date| is logical`));

        it(`1 is date | is logical`, () => expectNoSuggestions(`1 is date | is logical`));
    });
});
