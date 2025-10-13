// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, it, xit } from "bun:test";

import { TestConstants, TestUtils } from "..";
import { type AutocompleteItem } from "../../powerquery-language-services/inspection";

describe(`Multiple providers (TestConstants.SimpleLibraryAnalysisSettings)`, () => {
    describe(`getHover for key-value-pair`, () => {
        async function runTest(params: {
            readonly textWithPipe: string;
            readonly expected: string | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualHoverAnalysis({
                ...params,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            });
        }

        it(`let foobar =| ${TestConstants.TestLibraryName.SquareIfNumber}`, async () =>
            await runTest({
                textWithPipe: `let foobar =| ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let foobar = |${TestConstants.TestLibraryName.SquareIfNumber}`, async () =>
            await runTest({
                textWithPipe: `let foobar = |${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`, async () =>
            await runTest({
                textWithPipe: `let foobar = ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                expected: "[library function] Test.SquareIfNumber: (x: any) => any",
            }));

        it(`let foobar = ${TestConstants.TestLibraryName.SquareIfNumber} |`, async () =>
            await runTest({
                textWithPipe: `let foobar = ${TestConstants.TestLibraryName.SquareIfNumber} |`,
                expected: undefined,
            }));

        it(`let| foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, async () =>
            await runTest({
                textWithPipe: `let| foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let |foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`, async () =>
            await runTest({
                textWithPipe: `let |foobar = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));

        it(`let foobar| = ${TestConstants.TestLibraryName.SquareIfNumber}`, async () =>
            await runTest({
                textWithPipe: `let foobar| = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: "[let-variable] foobar: (x: any) => any",
            }));

        it(`let foobar | = ${TestConstants.TestLibraryName.SquareIfNumber}`, async () =>
            await runTest({
                textWithPipe: `let foobar | = ${TestConstants.TestLibraryName.SquareIfNumber}`,
                expected: undefined,
            }));
    });

    describe(`getAutocomplete for key-value-pair`, () => {
        async function runTest(params: {
            readonly textWithPipe: string;
            readonly expected?: {
                readonly labels: ReadonlyArray<string>;
                readonly isTextEdit: boolean;
            };
        }): Promise<AutocompleteItem[] | undefined> {
            return await TestUtils.assertAutocompleteAnalysis({
                ...params,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            });
        }

        it(`let|`, async () =>
            await runTest({
                textWithPipe: `let|`,
                expected: {
                    labels: [],
                    isTextEdit: false,
                },
            }));

        xit(`let foo|`, async () =>
            await runTest({
                textWithPipe: `let foo|`,
                expected: undefined,
            }));

        xit(`let foo |=`, async () =>
            await runTest({
                textWithPipe: `let foo |=`,
                expected: undefined,
            }));

        it(`let foo =|`, async () =>
            await runTest({
                textWithPipe: `let foo =|`,
                expected: {
                    labels: ["@foo", `@#"foo"`, "each", "error", "false", "if", "let", "not", "true", "try", "type"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = |`, async () =>
            await runTest({
                textWithPipe: `let foo = |`,
                expected: {
                    labels: ["@foo", `@#"foo"`, "each", "error", "false", "if", "let", "not", "true", "try", "type"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = |Test`, async () =>
            await runTest({
                textWithPipe: `let foo = |Test`,
                expected: {
                    labels: [
                        "@foo",
                        `@#"foo"`,
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
                        TestConstants.TestLibraryName.DynamicFunction,
                        TestConstants.TestLibraryName.DynamicValue,
                        TestConstants.TestLibraryName.Number,
                        TestConstants.TestLibraryName.NumberOne,
                        TestConstants.TestLibraryName.SquareIfNumber,
                    ],
                    isTextEdit: false,
                },
            }));

        it(`let foo = | Test`, async () =>
            await runTest({
                textWithPipe: `let foo = | Test`,
                expected: {
                    labels: [
                        "@foo",
                        `@#"foo"`,
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
                        TestConstants.TestLibraryName.DynamicFunction,
                        TestConstants.TestLibraryName.DynamicValue,
                        TestConstants.TestLibraryName.Number,
                        TestConstants.TestLibraryName.NumberOne,
                        TestConstants.TestLibraryName.SquareIfNumber,
                    ],
                    isTextEdit: false,
                },
            }));

        it(`let foo = Test|`, async () =>
            await runTest({
                textWithPipe: `let foo = Test|`,
                expected: {
                    labels: [
                        "@foo",
                        `@#"foo"`,
                        TestConstants.TestLibraryName.CombineNumberAndOptionalText,
                        TestConstants.TestLibraryName.CreateFooAndBarRecord,
                        TestConstants.TestLibraryName.DynamicFunction,
                        TestConstants.TestLibraryName.DynamicValue,
                        TestConstants.TestLibraryName.Number,
                        TestConstants.TestLibraryName.NumberOne,
                        TestConstants.TestLibraryName.SquareIfNumber,
                    ],
                    isTextEdit: false,
                },
            }));

        it(`let foo = Test |`, async () =>
            await runTest({
                textWithPipe: `let foo = Test |`,
                expected: {
                    labels: ["in"],
                    isTextEdit: false,
                },
            }));
    });
});
