// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { ArrayUtils, Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { PrimitiveTypeConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    describe(`AutocompleteItem.label`, () => {
        async function expectNoSuggestions(textWithPipe: string): Promise<void> {
            await expectLabels(textWithPipe, [], undefined);
        }

        async function expectLabelInserts(
            textWithPipe: string,
            expected: ReadonlyArray<PrimitiveTypeConstant>,
        ): Promise<void> {
            await expectLabels(textWithPipe, expected, false);
        }

        async function expectLabelTextEdits(
            textWithPipe: string,
            expected: ReadonlyArray<PrimitiveTypeConstant>,
        ): Promise<void> {
            await expectLabels(textWithPipe, expected, true);
        }

        async function expectLabels(
            textWithPipe: string,
            expected: ReadonlyArray<PrimitiveTypeConstant>,
            isTextEditExpected?: boolean,
        ): Promise<void> {
            const autocomplete: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
                TestConstants.DefaultInspectionSettings,
                textWithPipe,
            );

            ResultUtils.assertIsOk(autocomplete.triedPrimitiveType);
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = autocomplete.triedPrimitiveType.value;

            TestUtils.assertAutocompleteItemLabels(expected, actual);

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
        }

        const AllowedPrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = [
            PrimitiveTypeConstant.Action,
            PrimitiveTypeConstant.Any,
            PrimitiveTypeConstant.AnyNonNull,
            PrimitiveTypeConstant.Binary,
            PrimitiveTypeConstant.Date,
            PrimitiveTypeConstant.DateTime,
            PrimitiveTypeConstant.DateTimeZone,
            PrimitiveTypeConstant.Duration,
            PrimitiveTypeConstant.Function,
            PrimitiveTypeConstant.List,
            PrimitiveTypeConstant.Logical,
            PrimitiveTypeConstant.Null,
            PrimitiveTypeConstant.Number,
            PrimitiveTypeConstant.Record,
            PrimitiveTypeConstant.Table,
            PrimitiveTypeConstant.Text,
            PrimitiveTypeConstant.Time,
            PrimitiveTypeConstant.Type,
        ];

        const DatePrimitiveTypeConstants: ReadonlyArray<PrimitiveTypeConstant> = AllowedPrimitiveTypeConstants.filter(
            (value: PrimitiveTypeConstant) => value.includes("date"),
        );

        const NPrimitiveTypes: ReadonlyArray<PrimitiveTypeConstant> = AllowedPrimitiveTypeConstants.filter(
            (value: PrimitiveTypeConstant) => value.includes("n"),
        );

        it(`type|`, () => expectNoSuggestions(`type|`));

        it(`| type`, () => expectNoSuggestions(`| type`));

        it(`type |`, () => expectLabelInserts(`type |`, AllowedPrimitiveTypeConstants));

        it(`type |n`, () => expectLabelTextEdits(`type |n`, NPrimitiveTypes));

        it(`type n|`, () => expectLabelTextEdits(`type n|`, NPrimitiveTypes));

        it(`type n |`, () => expectNoSuggestions(`type n |`));

        it(`type |date`, () => expectLabelTextEdits(`type |date`, DatePrimitiveTypeConstants));

        it(`type date|`, () => expectLabelTextEdits(`type date|`, DatePrimitiveTypeConstants));

        it(`type date |`, () => expectNoSuggestions(`type date |`));

        it(`| let x = type`, () => expectNoSuggestions(`| let x = type`));

        it(`let x = type|`, () => expectNoSuggestions(`let x = type|`));

        it(`let x = type |`, () => expectLabelInserts(`let x = type |`, AllowedPrimitiveTypeConstants));

        it(`type | number`, () => expectNoSuggestions(`type | number`));

        it(`type n|`, () => expectLabelTextEdits(`type n|`, NPrimitiveTypes));

        it(`type nullable|`, () => expectNoSuggestions(`type nullable|`));

        it(`type nullable |`, () => expectLabelInserts(`type nullable |`, AllowedPrimitiveTypeConstants));

        it(`type nullable n|`, () => expectLabelTextEdits(`type nullable n|`, NPrimitiveTypes));

        it(`type nullable |n`, () => expectLabelTextEdits(`type nullable |n`, NPrimitiveTypes));

        it(`type {|`, () => expectLabelInserts(`type {|`, AllowedPrimitiveTypeConstants));

        it(`type { date|`, () => expectLabelTextEdits(`type { date|`, DatePrimitiveTypeConstants));

        it(`type { |date`, () => expectLabelTextEdits(`type { |date`, DatePrimitiveTypeConstants));

        it(`type { | date`, () => expectNoSuggestions(`type { | date`));

        it(`type { date | `, () => expectNoSuggestions(`type { date | `));

        it(`type {date|}`, () => expectLabelTextEdits(`type {date|}`, DatePrimitiveTypeConstants));

        it(`type {|date}`, () => expectLabelTextEdits(`type {|date}`, DatePrimitiveTypeConstants));

        it(`type {date |}`, () => expectNoSuggestions(`type {date |}`));

        it(`type {| date}`, () => expectNoSuggestions(`type {| date}`));

        it(`type [x =|`, () => expectLabelInserts(`type [x =|`, AllowedPrimitiveTypeConstants));

        it(`type [x = |`, () => expectLabelInserts(`type [x = |`, AllowedPrimitiveTypeConstants));

        it(`type [x =|]`, () => expectLabelInserts(`type [x =|]`, AllowedPrimitiveTypeConstants));

        it(`type [x = |]`, () => expectLabelInserts(`type [x = |]`, AllowedPrimitiveTypeConstants));

        it(`type [x = | ]`, () => expectLabelInserts(`type [x = | ]`, AllowedPrimitiveTypeConstants));

        it(`type [x = date|`, () => expectLabelTextEdits(`type [x = date|`, DatePrimitiveTypeConstants));

        it(`type [x = |date`, () => expectLabelTextEdits(`type [x = |date`, DatePrimitiveTypeConstants));

        it(`type [x = |n`, () => expectLabelTextEdits(`type [x = |n`, NPrimitiveTypes));

        it(`type [x = n|`, () => expectLabelTextEdits(`type [x = n|`, NPrimitiveTypes));

        it(`type function (val as |date) as date`, () =>
            expectLabelTextEdits(`type function (val as |date) as date`, DatePrimitiveTypeConstants));

        it(`type function (val as date|) as date`, () =>
            expectLabelTextEdits(`type function (val as date|) as date`, DatePrimitiveTypeConstants));

        it(`type function (val as date) as |date`, () =>
            expectLabelTextEdits(`type function (val as date) as |date`, DatePrimitiveTypeConstants));

        it(`type function (val as date) as date|`, () =>
            expectLabelTextEdits(`type function (val as date) as date|`, DatePrimitiveTypeConstants));

        it(`type function (val as n|) as date`, () =>
            expectLabelTextEdits(`type function (val as n|) as date`, NPrimitiveTypes));

        it(`type function (val as n| ) as date`, () =>
            expectLabelTextEdits(`type function (val as n| ) as date`, NPrimitiveTypes));

        it(`type function (val as |n) as date`, () =>
            expectLabelTextEdits(`type function (val as |n) as date`, NPrimitiveTypes));

        it(`type function (val as n |) as date`, () => expectNoSuggestions(`type function (val as n |) as date`));

        it(`type function (val as | n) as date`, () => expectNoSuggestions(`type function (val as | n) as date`));

        it(`type function (val as date) as date |`, () => expectNoSuggestions(`type function (val as date) as date |`));

        it(`type function (val as date) as | date`, () => expectNoSuggestions(`type function (val as date) as | date`));

        it(`type table [x =|`, () => expectLabelInserts(`type table [x =|`, AllowedPrimitiveTypeConstants));

        it(`type table [x = |`, () => expectLabelInserts(`type table [x = |`, AllowedPrimitiveTypeConstants));

        it(`type table [x =|]`, () => expectLabelInserts(`type table [x =|]`, AllowedPrimitiveTypeConstants));

        it(`type table [x = |]`, () => expectLabelInserts(`type table [x = |]`, AllowedPrimitiveTypeConstants));

        it(`type table [x = | ]`, () => expectLabelInserts(`type table [x = | ]`, AllowedPrimitiveTypeConstants));

        it(`type table [x = date|`, () => expectLabelTextEdits(`type table [x = date|`, DatePrimitiveTypeConstants));

        it(`type table [x = |date`, () => expectLabelTextEdits(`type table [x = |date`, DatePrimitiveTypeConstants));

        it(`type table [x = |n`, () => expectLabelTextEdits(`type table [x = |n`, NPrimitiveTypes));

        it(`type table [x = n|`, () => expectLabelTextEdits(`type table [x = n|`, NPrimitiveTypes));

        it(`(x|) => 1`, () => expectNoSuggestions(`(x|) => 1`));

        it(`(x |) => 1`, () => expectNoSuggestions(`(x |) => 1`));

        it(`(x as|) => 1`, () => expectNoSuggestions(`(x as|) => 1`));

        it(`(x as |) => 1`, () => expectLabelInserts(`(x as |) => 1`, AllowedPrimitiveTypeConstants));

        it(`(x as | ) => 1`, () => expectLabelInserts(`(x as | ) => 1`, AllowedPrimitiveTypeConstants));

        it(`(x as date|) => 1`, () => expectLabelTextEdits(`(x as date|) => 1`, DatePrimitiveTypeConstants));

        it(`(x as date |) => 1`, () => expectNoSuggestions(`(x as date |) => 1`));

        it(`(x as n|) => 1`, () => expectLabelTextEdits(`(x as n|) => 1`, NPrimitiveTypes));

        it(`(x as n| ) => 1`, () => expectLabelTextEdits(`(x as n| ) => 1`, NPrimitiveTypes));

        it(`(x as num|) => 1`, () => expectLabelTextEdits(`(x as num|) => 1`, [PrimitiveTypeConstant.Number]));

        it(`(x as num| ) => 1`, () => expectLabelTextEdits(`(x as num| ) => 1`, [PrimitiveTypeConstant.Number]));

        it(`(x as nullable|) => 1`, () => expectNoSuggestions(`(x as nullable|) => 1`));

        it(`(x as nullable |) => 1`, () => expectLabelInserts(`(x as nullable |) => 1`, AllowedPrimitiveTypeConstants));

        it(`(x as nullable n|) => 1`, () => expectLabelTextEdits(`(x as nullable n|) => 1`, NPrimitiveTypes));

        it(`(x as nullable |n) => 1`, () => expectLabelTextEdits(`(x as nullable |n) => 1`, NPrimitiveTypes));

        it(`(x as nullable date|) => 1`, () =>
            expectLabelTextEdits(`(x as nullable date|) => 1`, DatePrimitiveTypeConstants));

        it(`(x as nullable date |) => 1`, () => expectNoSuggestions(`(x as nullable date |) => 1`));

        it(`1 as|`, () => expectNoSuggestions(`1 as|`));

        it(`1 as |`, () => expectLabelInserts(`1 as |`, AllowedPrimitiveTypeConstants));

        it(`| 1 as`, () => expectNoSuggestions(`| 1 as`));

        it(`1 as n|`, () => expectLabelTextEdits(`1 as n|`, NPrimitiveTypes));

        it(`1 as |n`, () => expectLabelTextEdits(`1 as |n`, NPrimitiveTypes));

        it(`1 as date|`, () => expectLabelTextEdits(`1 as date|`, DatePrimitiveTypeConstants));

        it(`1 as date| as logical`, () => expectLabelTextEdits(`1 as date| as logical`, DatePrimitiveTypeConstants));

        it(`1 as date | as logical`, () => expectNoSuggestions(`1 as date | as logical`));

        it(`1 as da |`, () => expectNoSuggestions(`1 as da |`));

        it(`1 is|`, () => expectNoSuggestions(`1 is|`));

        it(`1 is |`, () => expectLabelInserts(`1 is |`, AllowedPrimitiveTypeConstants));

        it(`| 1 is`, () => expectNoSuggestions(`| 1 is`));

        it(`1 is n|`, () => expectLabelTextEdits(`1 is n|`, NPrimitiveTypes));

        it(`1 is |n`, () => expectLabelTextEdits(`1 is |n`, NPrimitiveTypes));

        it(`1 is date|`, () => expectLabelTextEdits(`1 is date|`, DatePrimitiveTypeConstants));

        it(`1 is date| is logical`, () => expectLabelTextEdits(`1 is date| is logical`, DatePrimitiveTypeConstants));

        it(`1 is date | is logical`, () => expectNoSuggestions(`1 is date | is logical`));

        it(`1 is da |`, () => expectNoSuggestions(`1 is da |`));
    });
});
