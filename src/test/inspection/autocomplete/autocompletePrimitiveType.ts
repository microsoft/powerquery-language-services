// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { PrimitiveTypeConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    describe(`AutocompleteItem.label`, () => {
        async function runLabelTest(
            textWithPipe: string,
            expected: ReadonlyArray<PrimitiveTypeConstant>,
        ): Promise<void> {
            const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
                TestConstants.DefaultInspectionSettings,
                textWithPipe,
            );

            ResultUtils.assertIsOk(actual.triedPrimitiveType);
            TestUtils.assertAutocompleteItemLabels(expected, actual.triedPrimitiveType.value);
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

        xit(`type|`, () => runLabelTest(`type|`, []));

        xit(`type |`, () => runLabelTest(`type |`, AllowedPrimitiveTypeConstants));

        xit(`let x = type|`, () => runLabelTest(`let x = type|`, []));

        xit(`let x = type |`, () => runLabelTest(`let x = type |`, AllowedPrimitiveTypeConstants));

        xit(`type | number`, () => runLabelTest(`type | number`, []));

        xit(`type n|`, () => runLabelTest(`type n|`, [PrimitiveTypeConstant.Null, PrimitiveTypeConstant.Number]));

        it(`(x|) => 1`, () => runLabelTest(`(x|) => 1`, []));

        it(`(x |) => 1`, () => runLabelTest(`(x |) => 1`, []));

        it(`(x as|) => 1`, () => runLabelTest(`(x as|) => 1`, []));

        it(`(x as |) => 1`, () => runLabelTest(`(x as |) => 1`, AllowedPrimitiveTypeConstants));

        it(`(x as | ) => 1`, () => runLabelTest(`(x as | ) => 1`, AllowedPrimitiveTypeConstants));

        it(`(x as date|) => 1`, () =>
            runLabelTest(`(x as date|) => 1`, [
                PrimitiveTypeConstant.Date,
                PrimitiveTypeConstant.DateTime,
                PrimitiveTypeConstant.DateTimeZone,
            ]));

        it(`(x as date |) => 1`, () => runLabelTest(`(x as date |) => 1`, []));

        it(`(x as n|) => 1`, () =>
            runLabelTest(`(x as n|) => 1`, [PrimitiveTypeConstant.Null, PrimitiveTypeConstant.Number]));

        it(`(x as n| ) => 1`, () =>
            runLabelTest(`(x as n| ) => 1`, [PrimitiveTypeConstant.Null, PrimitiveTypeConstant.Number]));

        it(`(x as num|) => 1`, () => runLabelTest(`(x as num|) => 1`, [PrimitiveTypeConstant.Number]));

        it(`(x as num| ) => 1`, () => runLabelTest(`(x as num| ) => 1`, [PrimitiveTypeConstant.Number]));

        it(`(x as nullable|) => 1`, () => runLabelTest(`(x as nullable|) => 1`, []));

        it(`(x as nullable |) => 1`, () => runLabelTest(`(x as nullable |) => 1`, AllowedPrimitiveTypeConstants));

        it(`(x as nullable n|) => 1`, () =>
            runLabelTest(`(x as nullable n|) => 1`, [PrimitiveTypeConstant.Null, PrimitiveTypeConstant.Number]));

        it(`(x as nullable date|) => 1`, () =>
            runLabelTest(`(x as nullable date|) => 1`, [
                PrimitiveTypeConstant.Date,
                PrimitiveTypeConstant.DateTime,
                PrimitiveTypeConstant.DateTimeZone,
            ]));

        it(`(x as nullable date |) => 1`, () => runLabelTest(`(x as nullable date |) => 1`, []));

        xit(`1 is |`, () => runLabelTest(`1 is |`, AllowedPrimitiveTypeConstants));

        xit(`1 is n|`, () => runLabelTest(`1 is n|`, [PrimitiveTypeConstant.Null, PrimitiveTypeConstant.Number]));

        xit(`1 is date|`, () =>
            runLabelTest(`1 is date|`, [
                PrimitiveTypeConstant.Date,
                PrimitiveTypeConstant.DateTime,
                PrimitiveTypeConstant.DateTimeZone,
            ]));
    });

    // describe(`AutocompleteItem.textEdit`, () => {
    //     async function runTextEditTest(
    //         textWithPipe: string,
    //         expected: ReadonlyArray<{
    //             readonly label: Inspection.AutocompleteItem["label"];
    //             readonly textEdit: Inspection.AutocompleteItem["textEdit"];
    //         }>,
    //     ): Promise<void> {
    //         const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
    //             TestConstants.DefaultInspectionSettings,
    //             textWithPipe,
    //         );

    //         ResultUtils.assertIsOk(actual.triedPrimitiveType);

    //         TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedPrimitiveType.value);
    //     }
    // });
});
