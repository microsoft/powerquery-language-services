// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { TestConstants, TestUtils } from "..";
import { AutocompleteItem } from "../../powerquery-language-services/inspection";
import { ExpectCollectionMode } from "../testUtils";

describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, () => {
    describe(`getHover for key-value-pair`, () => {
        function runTest(params: {
            readonly textWithPipe: string;
            readonly expected: string | undefined;
        }): Promise<void> {
            return TestUtils.assertEqualHoverAnalysis({
                ...params,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            });
        }

        it(`let foobar =| ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest({
                textWithPipe: `let foobar =| ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let foobar = |${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest({
                textWithPipe: `let foobar = |${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`, () =>
            runTest({
                textWithPipe: `let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                expected: "[library function] Test.SquareIfNumber: (x: any) => any",
            }));

        it(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber} |`, () =>
            runTest({
                textWithPipe: `let foobar = ${TestConstants.TestLibraryName.SquareIfNumber} |`,
                expected: undefined,
            }));

        it(`let| foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest({
                textWithPipe: `let| foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let |foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest({
                textWithPipe: `let |foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let foobar| = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest({
                textWithPipe: `let foobar| = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: "[let-variable] foobar: (x: any) => any",
            }));

        it(`let foobar | = ${TestConstants.TestLibraryName.SquareIfNumber}`, () =>
            runTest({
                textWithPipe: `let foobar | = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));
    });

    describe(`getAutocomplete for key-value-pair`, () => {
        function runTest(params: {
            readonly textWithPipe: string;
            readonly expected?: {
                readonly labels: ReadonlyArray<string>;
                readonly isTextEdit: boolean;
            };
        }): Promise<AutocompleteItem[] | undefined> {
            return TestUtils.assertAutocompleteAnalysis({
                ...params,
                expected:
                    params.expected !== undefined
                        ? { ...params.expected, mode: ExpectCollectionMode.Contains }
                        : undefined,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            });
        }

        it(`let|`, () =>
            runTest({
                textWithPipe: `let|`,
                expected: {
                    labels: [],
                    isTextEdit: false,
                },
            }));

        xit(`let foo|`, () => runTest({ textWithPipe: `let foo|`, expected: undefined }));
        xit(`let foo |=`, () => runTest({ textWithPipe: `let foo |=`, expected: undefined }));

        it(`let foo =|`, () =>
            runTest({
                textWithPipe: `let foo =|`,
                expected: {
                    labels: ["@foo", "each", "error", "false", "if", "let", "not", "true", "try", "type"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = |`, () =>
            runTest({
                textWithPipe: `let foo = |`,
                expected: {
                    labels: ["@foo", "each", "error", "false", "if", "let", "not", "true", "try", "type"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = |Test`, () =>
            runTest({
                textWithPipe: `let foo = |Test`,
                expected: {
                    labels: [
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
                    ],
                    isTextEdit: false,
                },
            }));

        it(`let foo = | Test`, () =>
            runTest({
                textWithPipe: `let foo = | Test`,
                expected: {
                    labels: [
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
                    ],
                    isTextEdit: false,
                },
            }));

        it(`let foo = Test|`, () =>
            runTest({
                textWithPipe: `let foo = Test|`,
                expected: {
                    labels: [
                        "@foo",
                        TestConstants.TestLibraryName.CombineNumberAndOptionalText,
                        TestConstants.TestLibraryName.CreateFooAndBarRecord,
                        TestConstants.TestLibraryName.Number,
                        TestConstants.TestLibraryName.NumberOne,
                        TestConstants.TestLibraryName.SquareIfNumber,
                    ],
                    isTextEdit: false,
                },
            }));

        it(`let foo = Test |`, () =>
            runTest({
                textWithPipe: `let foo = Test |`,
                expected: {
                    labels: ["in"],
                    isTextEdit: false,
                },
            }));
    });
});
