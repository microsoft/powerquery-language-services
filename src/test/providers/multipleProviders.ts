// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";

import { Hover, Inspection } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";

describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, () => {
    describe(`getHover for key-value-pair`, () => {
        async function runTest(text: string, expectedHover: string | undefined): Promise<void> {
            const hover: Result<Hover | undefined, CommonError.CommonError> = await TestUtils.createHover(
                text,
                TestConstants.SimpleLibraryAnalysisSettings,
            );

            Assert.isOk(hover);

            if (expectedHover === undefined) {
                Assert.isUndefined(hover.value);
            } else {
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover(expectedHover, hover.value);
            }
        }

        it(`let foobar =| ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest(`let foobar =| ${TestConstants.TestLibraryName.SquareIfNumber}`, undefined));

        it(`let foobar = |${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest(`let foobar = |${TestConstants.TestLibraryName.SquareIfNumber}`, undefined));

        it(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`, () =>
            runTest(
                `let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                "[library function] Test.SquareIfNumber: (x: any) => any",
            ));

        it(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber} |`, () =>
            runTest(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber} |`, undefined));

        it(`let| foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest(`let| foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, undefined));

        it(`let |foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest(`let |foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, undefined));

        it(`let foobar| = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest(
                `let foobar| = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                "[let-variable] foobar: (x: any) => any",
            ));

        it(`let foobar | = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest(`let foobar | = ${TestConstants.TestLibraryName.SquareIfNumber}`, undefined));
    });

    describe(`getAutocomplete for key-value-pair`, () => {
        async function runTest(
            text: string,
            autocompleteItemLabels?: ReadonlyArray<string> | undefined,
        ): Promise<void> {
            const items: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await TestUtils.createAutocompleteItems(text, TestConstants.SimpleLibraryAnalysisSettings);

            Assert.isOk(items);

            if (autocompleteItemLabels) {
                Assert.isDefined(items.value);
                Assert.isDefined(autocompleteItemLabels);
                TestUtils.assertAutocompleteItemLabels(autocompleteItemLabels, items.value);
            } else {
                Assert.isUndefined(items.value);
            }
        }

        it(`let|`, () => runTest(`let|`, []));

        xit(`let foo|`, () => runTest(`let foo|`));

        xit(`let foo |=`, () => runTest(`let foo |=`));

        it(`let foo =|`, () =>
            runTest(`let foo =|`, ["@foo", "each", "error", "false", "if", "let", "not", "true", "try", "type"]));

        it(`let foo = |`, () =>
            runTest(`let foo = |`, ["@foo", "each", "error", "false", "if", "let", "not", "true", "try", "type"]));

        it(`let foo = |Test`, () =>
            runTest(`let foo = |Test`, [
                "@foo",
                "each",
                "error",
                "false",
                "if",
                "let",
                "not",
                "true",
                "try",
                "type",
                TestConstants.TestLibraryName.CombineNumberAndOptionalText,
                TestConstants.TestLibraryName.CreateFooAndBarRecord,
                TestConstants.TestLibraryName.Number,
                TestConstants.TestLibraryName.NumberOne,
                TestConstants.TestLibraryName.SquareIfNumber,
            ]));

        it(`let foo = | Test`, () =>
            runTest(`let foo = | Test`, [
                "@foo",
                "each",
                "error",
                "false",
                "if",
                "let",
                "not",
                "true",
                "try",
                "type",
                TestConstants.TestLibraryName.CombineNumberAndOptionalText,
                TestConstants.TestLibraryName.CreateFooAndBarRecord,
                TestConstants.TestLibraryName.Number,
                TestConstants.TestLibraryName.NumberOne,
                TestConstants.TestLibraryName.SquareIfNumber,
            ]));

        it(`let foo = Test|`, () =>
            runTest(`let foo = Test|`, [
                "@foo",
                TestConstants.TestLibraryName.CombineNumberAndOptionalText,
                TestConstants.TestLibraryName.CreateFooAndBarRecord,
                TestConstants.TestLibraryName.Number,
                TestConstants.TestLibraryName.NumberOne,
                TestConstants.TestLibraryName.SquareIfNumber,
            ]));

        it(`let foo = Test |`, () => runTest(`let foo = Test |`, ["in"]));
    });
});
