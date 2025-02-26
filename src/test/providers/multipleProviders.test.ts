// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { TestConstants, TestUtils } from "..";

describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, () => {
    describe(`getHover for key-value-pair`, () => {
        async function runTest(textWithPipe: string, expected: string | undefined): Promise<void> {
            await TestUtils.assertEqualHoverAnalysis(
                textWithPipe,
                expected,
                TestConstants.SimpleLibraryAnalysisSettings,
            );
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
        async function runTest(textWithPipe: string, expected: ReadonlyArray<string> | undefined): Promise<void> {
            await TestUtils.assertContainsAutocompleteAnalysis(
                textWithPipe,
                expected,
                TestConstants.SimpleLibraryAnalysisSettings,
            );
        }

        it(`let|`, () => runTest(`let|`, []));

        xit(`let foo|`, () => runTest(`let foo|`, undefined));

        xit(`let foo |=`, () => runTest(`let foo |=`, undefined));

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
