// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, it } from "bun:test";
import {
    KeywordConstant,
    UnaryOperator,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/constant/constant";
import { type SignatureInformation } from "vscode-languageserver-types";

import { type AnalysisSettings, NullSymbolProvider } from "../../powerquery-language-services";
import { type AutocompleteItem, type TypeCache } from "../../powerquery-language-services/inspection";
import { TestConstants, TestUtils } from "..";
import { type ILibrary } from "../../powerquery-language-services/library/library";
import { TestLibraryName } from "../testConstants";

describe(`SimpleLibraryProvider`, () => {
    const IsolatedAnalysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        localDocumentProviderFactory: (_uri: string, _typeCache: TypeCache, _library: ILibrary) =>
            NullSymbolProvider.singleton(),
    };

    describe(`getAutocompleteItems`, () => {
        async function runTest(params: {
            readonly textWithPipe: string;
            readonly expected: {
                readonly labels: ReadonlyArray<string>;
                readonly isTextEdit: boolean;
            };
        }): Promise<AutocompleteItem[] | undefined> {
            return await TestUtils.assertAutocompleteAnalysis({
                ...params,
                analysisSettings: IsolatedAnalysisSettings,
            });
        }

        const expectedAutocompleteLabels: ReadonlyArray<string> = [
            KeywordConstant.Each,
            KeywordConstant.Error,
            KeywordConstant.False,
            KeywordConstant.If,
            KeywordConstant.Let,
            KeywordConstant.Section,
            KeywordConstant.True,
            KeywordConstant.Try,
            KeywordConstant.Type,
            TestLibraryName.CombineNumberAndOptionalText,
            TestLibraryName.CreateFooAndBarRecord,
            TestLibraryName.DynamicFunction,
            TestLibraryName.DynamicValue,
            TestLibraryName.Number,
            TestLibraryName.NumberOne,
            TestLibraryName.SquareIfNumber,
            UnaryOperator.Not,
        ];

        it(`match`, async () =>
            await runTest({
                textWithPipe: `Test.NumberO|`,
                expected: {
                    labels: expectedAutocompleteLabels,
                    isTextEdit: false,
                },
            }));

        it(`match multiple`, async () =>
            await runTest({
                textWithPipe: `Test.Numbe|`,
                expected: {
                    labels: expectedAutocompleteLabels,
                    isTextEdit: false,
                },
            }));

        it(`unknown match`, async () =>
            await runTest({
                textWithPipe: `Unknown|Identifier`,
                expected: {
                    labels: expectedAutocompleteLabels,
                    isTextEdit: false,
                },
            }));
    });

    describe(`getHover`, () => {
        async function assertHoverAnalysis(params: {
            readonly textWithPipe: string;
            readonly expected: string | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualHoverAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        it(`constant`, async () =>
            await assertHoverAnalysis({
                textWithPipe: `Test.Num|ber`,
                expected: `[library constant] Test.Number: number`,
            }));

        it(`function`, async () =>
            await assertHoverAnalysis({
                textWithPipe: `Test.Square|IfNumber`,
                expected: `[library function] Test.SquareIfNumber: (x: any) => any`,
            }));

        it(`no match`, async () =>
            await assertHoverAnalysis({
                textWithPipe: `Unknown|Identifier`,
                expected: undefined,
            }));
    });

    describe(`getSignatureHelp`, () => {
        const squareIfNumberSignatureInformation: SignatureInformation = {
            documentation: "The name is Test.SquareIfNumber",
            label: "Test.SquareIfNumber",
            parameters: [
                {
                    documentation: undefined,
                    label: "x",
                },
            ],
        };

        async function assertSignatureHelp(params: {
            readonly textWithPipe: string;
            readonly activeParameter?: number;
        }): Promise<void> {
            await TestUtils.assertEqualSignatureHelpAnalysis({
                textWithPipe: params.textWithPipe,
                expected:
                    params.activeParameter !== undefined
                        ? {
                              activeParameter: params.activeParameter,
                              activeSignature: 0,
                              signatures: [squareIfNumberSignatureInformation],
                          }
                        : undefined,
                analysisSettings: IsolatedAnalysisSettings,
            });
        }

        it(`unknown identifier`, async () =>
            await assertSignatureHelp({
                textWithPipe: `Unknown|Identifier`,
                activeParameter: undefined,
            }));

        it(`first parameter, no literal`, async () =>
            await assertSignatureHelp({
                textWithPipe: `Test.SquareIfNumber(|`,
                activeParameter: 0,
            }));

        it(`first parameter, literal, no comma`, async () =>
            await assertSignatureHelp({
                textWithPipe: `Test.SquareIfNumber(1|`,
                activeParameter: 0,
            }));

        it(`first parameter, literal, comma`, async () =>
            await assertSignatureHelp({
                textWithPipe: `Test.SquareIfNumber(1,|`,
                activeParameter: 1,
            }));
    });
});
