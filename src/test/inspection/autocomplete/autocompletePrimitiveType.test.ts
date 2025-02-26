// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    PrimitiveTypeConstant,
    PrimitiveTypeConstants,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";

import {
    AbridgedAutocompleteItem,
    expectAbridgedAutocompleteItems,
    expectNoSuggestions,
    expectTopSuggestions,
} from "../../testUtils/autocompleteTestUtils";
import { Inspection } from "../../../powerquery-language-services";
import { ResultUtils } from "@microsoft/powerquery-parser";

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    function assertAutocompletePrimitiveType(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedPrimitiveType);
    }

    function expectNoPrimitiveTypeSuggestions(textWithPipe: string): Promise<void> {
        return expectNoSuggestions(textWithPipe, assertAutocompletePrimitiveType);
    }

    async function expectPrimitiveTypeInserts(textWithPipe: string): Promise<void> {
        await expectAbridgedAutocompleteItems(
            textWithPipe,
            assertAutocompletePrimitiveType,
            AbridgedAllowedPrimitiveTypeConstantInserts,
        );
    }

    function expectDatePrimitiveTypeReplacements(textWithPipe: string): Promise<void> {
        return expectTopSuggestions(textWithPipe, assertAutocompletePrimitiveType, AbridgedDateEdits);
    }

    const AllowedPrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = PrimitiveTypeConstants.filter(
        (constant: PrimitiveTypeConstant) => constant !== PrimitiveTypeConstant.None,
    );

    const DateConstants: ReadonlyArray<PrimitiveTypeConstant> = PrimitiveTypeConstants.filter(
        (constant: PrimitiveTypeConstant) => constant.includes(PrimitiveTypeConstant.Date),
    );

    const AbridgedAllowedPrimitiveTypeConstantInserts: ReadonlyArray<AbridgedAutocompleteItem> =
        AllowedPrimitiveTypeConstants.map((value: PrimitiveTypeConstant) => ({
            label: value,
            isTextEdit: false,
        }));

    const AbridgedDateEdits: ReadonlyArray<AbridgedAutocompleteItem> = DateConstants.map(
        (value: PrimitiveTypeConstant) => ({
            label: value,
            isTextEdit: true,
        }),
    );

    it(`|`, () => expectNoPrimitiveTypeSuggestions(`|`));

    it(`l|`, () => expectNoPrimitiveTypeSuggestions(`l|`));

    it(`if |`, () => expectNoPrimitiveTypeSuggestions(`if |`));

    it(`type|`, () => expectNoPrimitiveTypeSuggestions(`type|`));

    it(`| type`, () => expectNoPrimitiveTypeSuggestions(`| type`));

    it(`type |`, () => expectPrimitiveTypeInserts(`type |`));

    it(`type |date`, () => expectDatePrimitiveTypeReplacements(`type |date`));

    it(`type date|`, () => expectDatePrimitiveTypeReplacements(`type date|`));

    it(`type date |`, () => expectNoPrimitiveTypeSuggestions(`type date |`));

    it(`| let x = type`, () => expectNoPrimitiveTypeSuggestions(`| let x = type`));

    it(`let x = type|`, () => expectNoPrimitiveTypeSuggestions(`let x = type|`));

    it(`let x = type |`, () => expectPrimitiveTypeInserts(`let x = type |`));

    it(`type | number`, () => expectNoPrimitiveTypeSuggestions(`type | number`));

    it(`type nullable|`, () => expectNoPrimitiveTypeSuggestions(`type nullable|`));

    it(`type nullable |`, () => expectPrimitiveTypeInserts(`type nullable |`));

    it(`type nullable date|`, () => expectDatePrimitiveTypeReplacements(`type nullable date|`));

    it(`type nullable |date`, () => expectDatePrimitiveTypeReplacements(`type nullable |date`));

    it(`type {|`, () => expectPrimitiveTypeInserts(`type {|`));

    it(`type { |`, () => expectPrimitiveTypeInserts(`type { |`));

    it(`type { number |`, () => expectNoPrimitiveTypeSuggestions(`type { number |`));

    it(`type { number |}`, () => expectNoPrimitiveTypeSuggestions(`type { number |}`));

    it(`type { number }|`, () => expectNoPrimitiveTypeSuggestions(`type { number }|`));

    it(`type { date|`, () => expectDatePrimitiveTypeReplacements(`type { date|`));

    it(`type { |date`, () => expectDatePrimitiveTypeReplacements(`type { |date`));

    it(`type { | date`, () => expectNoPrimitiveTypeSuggestions(`type { | date`));

    it(`type { date | `, () => expectNoPrimitiveTypeSuggestions(`type { date | `));

    it(`type { date | } `, () => expectNoPrimitiveTypeSuggestions(`type { date | } `));

    it(`type {date|}`, () => expectDatePrimitiveTypeReplacements(`type {date|}`));

    it(`type {|date}`, () => expectDatePrimitiveTypeReplacements(`type {|date}`));

    it(`type [x =|`, () => expectPrimitiveTypeInserts(`type [x =|`));

    it(`type [x = |`, () => expectPrimitiveTypeInserts(`type [x = |`));

    it(`type [x =|]`, () => expectPrimitiveTypeInserts(`type [x =|]`));

    it(`type [x = |]`, () => expectPrimitiveTypeInserts(`type [x = |]`));

    it(`type [x = | ]`, () => expectPrimitiveTypeInserts(`type [x = | ]`));

    it(`type [x = date|`, () => expectDatePrimitiveTypeReplacements(`type [x = date|`));

    it(`type [x = |date`, () => expectDatePrimitiveTypeReplacements(`type [x = |date`));

    it(`type [x = date |]`, () => expectNoPrimitiveTypeSuggestions(`type [x = date |]`));

    it(`type [x = date ]|`, () => expectNoPrimitiveTypeSuggestions(`type [x = date ]|`));

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

    it(`type function (val as n |) as date`, () =>
        expectNoPrimitiveTypeSuggestions(`type function (val as n |) as date`));

    it(`type function (val as | n) as date`, () =>
        expectNoPrimitiveTypeSuggestions(`type function (val as | n) as date`));

    it(`type function (val as date) as date |`, () =>
        expectNoPrimitiveTypeSuggestions(`type function (val as date) as date |`));

    it(`type function (val as date) as | date`, () =>
        expectNoPrimitiveTypeSuggestions(`type function (val as date) as | date`));

    it(`type table [x =|`, () => expectPrimitiveTypeInserts(`type table [x =|`));

    it(`type table [x = |`, () => expectPrimitiveTypeInserts(`type table [x = |`));

    it(`type table [x =|]`, () => expectPrimitiveTypeInserts(`type table [x =|]`));

    it(`type table [x = |]`, () => expectPrimitiveTypeInserts(`type table [x = |]`));

    it(`type table [x = | ]`, () => expectPrimitiveTypeInserts(`type table [x = | ]`));

    it(`type table [x = date|`, () => expectDatePrimitiveTypeReplacements(`type table [x = date|`));

    it(`type table [x = |date`, () => expectDatePrimitiveTypeReplacements(`type table [x = |date`));

    it(`(x|) => 1`, () => expectNoPrimitiveTypeSuggestions(`(x|) => 1`));

    it(`(x |) => 1`, () => expectNoPrimitiveTypeSuggestions(`(x |) => 1`));

    it(`(x as|) => 1`, () => expectNoPrimitiveTypeSuggestions(`(x as|) => 1`));

    it(`(x as |) => 1`, () => expectPrimitiveTypeInserts(`(x as |) => 1`));

    it(`(x as | ) => 1`, () => expectPrimitiveTypeInserts(`(x as | ) => 1`));

    it(`(x as date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as date|) => 1`));

    it(`(x as date |) => 1`, () => expectNoPrimitiveTypeSuggestions(`(x as date |) => 1`));

    it(`(x as date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as date|) => 1`));

    it(`(x as date| ) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as date| ) => 1`));

    it(`(x as nullable|) => 1`, () => expectNoPrimitiveTypeSuggestions(`(x as nullable|) => 1`));

    it(`(x as nullable |) => 1`, () => expectPrimitiveTypeInserts(`(x as nullable |) => 1`));

    it(`(x as nullable date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as nullable date|) => 1`));

    it(`(x as nullable |date) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as nullable |date) => 1`));

    it(`(x as nullable date|) => 1`, () => expectDatePrimitiveTypeReplacements(`(x as nullable date|) => 1`));

    it(`(x as nullable date |) => 1`, () => expectNoPrimitiveTypeSuggestions(`(x as nullable date |) => 1`));

    it(`1 as|`, () => expectNoPrimitiveTypeSuggestions(`1 as|`));

    it(`1 as |`, () => expectPrimitiveTypeInserts(`1 as |`));

    it(`| 1 as`, () => expectNoPrimitiveTypeSuggestions(`| 1 as`));

    it(`1 as date|`, () => expectDatePrimitiveTypeReplacements(`1 as date|`));

    it(`1 as |date`, () => expectDatePrimitiveTypeReplacements(`1 as |date`));

    it(`1 as date| as logical`, () => expectDatePrimitiveTypeReplacements(`1 as date| as logical`));

    it(`1 as date | as logical`, () => expectNoPrimitiveTypeSuggestions(`1 as date | as logical`));

    it(`1 as da |`, () => expectNoPrimitiveTypeSuggestions(`1 as da |`));

    it(`1 is|`, () => expectNoPrimitiveTypeSuggestions(`1 is|`));

    it(`1 is |`, () => expectPrimitiveTypeInserts(`1 is |`));

    it(`| 1 is`, () => expectNoPrimitiveTypeSuggestions(`| 1 is`));

    it(`1 is date|`, () => expectDatePrimitiveTypeReplacements(`1 is date|`));

    it(`1 is |date`, () => expectDatePrimitiveTypeReplacements(`1 is |date`));

    it(`1 is date| is logical`, () => expectDatePrimitiveTypeReplacements(`1 is date| is logical`));

    it(`1 is date | is logical`, () => expectNoPrimitiveTypeSuggestions(`1 is date | is logical`));
});
