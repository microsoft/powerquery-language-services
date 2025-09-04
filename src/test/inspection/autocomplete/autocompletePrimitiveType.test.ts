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

    async function expectNoPrimitiveTypeSuggestions(textWithPipe: string): Promise<void> {
        await expectNoSuggestions({
            textWithPipe,
            autocompleteItemSelector: assertAutocompletePrimitiveType,
        });
    }

    async function expectPrimitiveTypeInserts(textWithPipe: string): Promise<void> {
        await expectAbridgedAutocompleteItems({
            textWithPipe,
            autocompleteItemSelector: assertAutocompletePrimitiveType,
            expected: AbridgedAllowedPrimitiveTypeConstantInserts,
        });
    }

    async function expectDatePrimitiveTypeReplacements(textWithPipe: string): Promise<void> {
        await expectTopSuggestions(textWithPipe, assertAutocompletePrimitiveType, AbridgedDateEdits);
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

    it(`|`, async () => await expectNoPrimitiveTypeSuggestions(`|`));

    it(`l|`, async () => await expectNoPrimitiveTypeSuggestions(`l|`));

    it(`if |`, async () => await expectNoPrimitiveTypeSuggestions(`if |`));

    it(`type|`, async () => await expectNoPrimitiveTypeSuggestions(`type|`));

    it(`| type`, async () => await expectNoPrimitiveTypeSuggestions(`| type`));

    it(`type |`, async () => await expectPrimitiveTypeInserts(`type |`));

    it(`type |date`, async () => await expectDatePrimitiveTypeReplacements(`type |date`));

    it(`type date|`, async () => await expectDatePrimitiveTypeReplacements(`type date|`));

    it(`type date |`, async () => await expectNoPrimitiveTypeSuggestions(`type date |`));

    it(`| let x = type`, async () => await expectNoPrimitiveTypeSuggestions(`| let x = type`));

    it(`let x = type|`, async () => await expectNoPrimitiveTypeSuggestions(`let x = type|`));

    it(`let x = type |`, async () => await expectPrimitiveTypeInserts(`let x = type |`));

    it(`type | number`, async () => await expectNoPrimitiveTypeSuggestions(`type | number`));

    it(`type nullable|`, async () => await expectNoPrimitiveTypeSuggestions(`type nullable|`));

    it(`type nullable |`, async () => await expectPrimitiveTypeInserts(`type nullable |`));

    it(`type nullable date|`, async () => await expectDatePrimitiveTypeReplacements(`type nullable date|`));

    it(`type nullable |date`, async () => await expectDatePrimitiveTypeReplacements(`type nullable |date`));

    it(`type {|`, async () => await expectPrimitiveTypeInserts(`type {|`));

    it(`type { |`, async () => await expectPrimitiveTypeInserts(`type { |`));

    it(`type { number |`, async () => await expectNoPrimitiveTypeSuggestions(`type { number |`));

    it(`type { number |}`, async () => await expectNoPrimitiveTypeSuggestions(`type { number |}`));

    it(`type { number }|`, async () => await expectNoPrimitiveTypeSuggestions(`type { number }|`));

    it(`type { date|`, async () => await expectDatePrimitiveTypeReplacements(`type { date|`));

    it(`type { |date`, async () => await expectDatePrimitiveTypeReplacements(`type { |date`));

    it(`type { | date`, async () => await expectNoPrimitiveTypeSuggestions(`type { | date`));

    it(`type { date | `, async () => await expectNoPrimitiveTypeSuggestions(`type { date | `));

    it(`type { date | } `, async () => await expectNoPrimitiveTypeSuggestions(`type { date | } `));

    it(`type {date|}`, async () => await expectDatePrimitiveTypeReplacements(`type {date|}`));

    it(`type {|date}`, async () => await expectDatePrimitiveTypeReplacements(`type {|date}`));

    it(`type [x =|`, async () => await expectPrimitiveTypeInserts(`type [x =|`));

    it(`type [x = |`, async () => await expectPrimitiveTypeInserts(`type [x = |`));

    it(`type [x =|]`, async () => await expectPrimitiveTypeInserts(`type [x =|]`));

    it(`type [x = |]`, async () => await expectPrimitiveTypeInserts(`type [x = |]`));

    it(`type [x = | ]`, async () => await expectPrimitiveTypeInserts(`type [x = | ]`));

    it(`type [x = date|`, async () => await expectDatePrimitiveTypeReplacements(`type [x = date|`));

    it(`type [x = |date`, async () => await expectDatePrimitiveTypeReplacements(`type [x = |date`));

    it(`type [x = date |]`, async () => await expectNoPrimitiveTypeSuggestions(`type [x = date |]`));

    it(`type [x = date ]|`, async () => await expectNoPrimitiveTypeSuggestions(`type [x = date ]|`));

    it(`type function (val as |date) as date`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as |date) as date`));

    it(`type function (val as date|) as date`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as date|) as date`));

    it(`type function (val as date) as |date`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as date) as |date`));

    it(`type function (val as date) as date|`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as date) as date|`));

    it(`type function (val as date|) as date`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as date|) as date`));

    it(`type function (val as date| ) as date`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as date| ) as date`));

    it(`type function (val as |date) as date`, async () =>
        await expectDatePrimitiveTypeReplacements(`type function (val as |date) as date`));

    it(`type function (val as n |) as date`, async () =>
        await expectNoPrimitiveTypeSuggestions(`type function (val as n |) as date`));

    it(`type function (val as | n) as date`, async () =>
        await expectNoPrimitiveTypeSuggestions(`type function (val as | n) as date`));

    it(`type function (val as date) as date |`, async () =>
        await expectNoPrimitiveTypeSuggestions(`type function (val as date) as date |`));

    it(`type function (val as date) as | date`, async () =>
        await expectNoPrimitiveTypeSuggestions(`type function (val as date) as | date`));

    it(`type table [x =|`, async () => await expectPrimitiveTypeInserts(`type table [x =|`));

    it(`type table [x = |`, async () => await expectPrimitiveTypeInserts(`type table [x = |`));

    it(`type table [x =|]`, async () => await expectPrimitiveTypeInserts(`type table [x =|]`));

    it(`type table [x = |]`, async () => await expectPrimitiveTypeInserts(`type table [x = |]`));

    it(`type table [x = | ]`, async () => await expectPrimitiveTypeInserts(`type table [x = | ]`));

    it(`type table [x = date|`, async () => await expectDatePrimitiveTypeReplacements(`type table [x = date|`));

    it(`type table [x = |date`, async () => await expectDatePrimitiveTypeReplacements(`type table [x = |date`));

    it(`(x|) => 1`, async () => await expectNoPrimitiveTypeSuggestions(`(x|) => 1`));

    it(`(x |) => 1`, async () => await expectNoPrimitiveTypeSuggestions(`(x |) => 1`));

    it(`(x as|) => 1`, async () => await expectNoPrimitiveTypeSuggestions(`(x as|) => 1`));

    it(`(x as |) => 1`, async () => await expectPrimitiveTypeInserts(`(x as |) => 1`));

    it(`(x as | ) => 1`, async () => await expectPrimitiveTypeInserts(`(x as | ) => 1`));

    it(`(x as date|) => 1`, async () => await expectDatePrimitiveTypeReplacements(`(x as date|) => 1`));

    it(`(x as date |) => 1`, async () => await expectNoPrimitiveTypeSuggestions(`(x as date |) => 1`));

    it(`(x as date|) => 1`, async () => await expectDatePrimitiveTypeReplacements(`(x as date|) => 1`));

    it(`(x as date| ) => 1`, async () => await expectDatePrimitiveTypeReplacements(`(x as date| ) => 1`));

    it(`(x as nullable|) => 1`, async () => await expectNoPrimitiveTypeSuggestions(`(x as nullable|) => 1`));

    it(`(x as nullable |) => 1`, async () => await expectPrimitiveTypeInserts(`(x as nullable |) => 1`));

    it(`(x as nullable date|) => 1`, async () =>
        await expectDatePrimitiveTypeReplacements(`(x as nullable date|) => 1`));

    it(`(x as nullable |date) => 1`, async () =>
        await expectDatePrimitiveTypeReplacements(`(x as nullable |date) => 1`));

    it(`(x as nullable date|) => 1`, async () =>
        await expectDatePrimitiveTypeReplacements(`(x as nullable date|) => 1`));

    it(`(x as nullable date |) => 1`, async () =>
        await expectNoPrimitiveTypeSuggestions(`(x as nullable date |) => 1`));

    it(`1 as|`, async () => await expectNoPrimitiveTypeSuggestions(`1 as|`));

    it(`1 as |`, async () => await expectPrimitiveTypeInserts(`1 as |`));

    it(`| 1 as`, async () => await expectNoPrimitiveTypeSuggestions(`| 1 as`));

    it(`1 as date|`, async () => await expectDatePrimitiveTypeReplacements(`1 as date|`));

    it(`1 as |date`, async () => await expectDatePrimitiveTypeReplacements(`1 as |date`));

    it(`1 as date| as logical`, async () => await expectDatePrimitiveTypeReplacements(`1 as date| as logical`));

    it(`1 as date | as logical`, async () => await expectNoPrimitiveTypeSuggestions(`1 as date | as logical`));

    it(`1 as da |`, async () => await expectNoPrimitiveTypeSuggestions(`1 as da |`));

    it(`1 is|`, async () => await expectNoPrimitiveTypeSuggestions(`1 is|`));

    it(`1 is |`, async () => await expectPrimitiveTypeInserts(`1 is |`));

    it(`| 1 is`, async () => await expectNoPrimitiveTypeSuggestions(`| 1 is`));

    it(`1 is date|`, async () => await expectDatePrimitiveTypeReplacements(`1 is date|`));

    it(`1 is |date`, async () => await expectDatePrimitiveTypeReplacements(`1 is |date`));

    it(`1 is date| is logical`, async () => await expectDatePrimitiveTypeReplacements(`1 is date| is logical`));

    it(`1 is date | is logical`, async () => await expectNoPrimitiveTypeSuggestions(`1 is date | is logical`));
});
