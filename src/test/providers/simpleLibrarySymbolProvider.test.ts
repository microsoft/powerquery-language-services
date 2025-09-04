// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { SignatureInformation } from "vscode-languageserver-types";

import { AnalysisSettings, NullSymbolProvider } from "../../powerquery-language-services";
import { AutocompleteItem, TypeCache } from "../../powerquery-language-services/inspection";
import { TestConstants, TestUtils } from "..";
import { ExpectCollectionMode } from "../testUtils";
import { ILibrary } from "../../powerquery-language-services/library/library";

describe(`SimpleLibraryProvider`, () => {
    const IsolatedAnalysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        localDocumentProviderFactory: (_uri: string, _typeCache: TypeCache, _library: ILibrary) =>
            NullSymbolProvider.singleton(),
    };

    describe(`getAutocompleteItems`, () => {
        function runTest(params: {
            readonly textWithPipe: string;
            readonly expected: {
                readonly labels: ReadonlyArray<string>;
                readonly isTextEdit: boolean;
                readonly mode?: ExpectCollectionMode;
            };
        }): Promise<AutocompleteItem[] | undefined> {
            return TestUtils.assertAutocompleteAnalysis({
                ...params,
                expected: {
                    ...params.expected,
                    mode: params.expected.mode ?? ExpectCollectionMode.Contains,
                },
                analysisSettings: IsolatedAnalysisSettings,
            });
        }

        it(`match`, () =>
            runTest({
                textWithPipe: `Test.NumberO|`,
                expected: {
                    labels: [TestConstants.TestLibraryName.NumberOne],
                    isTextEdit: false,
                },
            }));

        it(`match multiple`, () =>
            runTest({
                textWithPipe: `Test.Numbe|`,
                expected: {
                    labels: [TestConstants.TestLibraryName.Number, TestConstants.TestLibraryName.NumberOne],
                    isTextEdit: false,
                },
            }));

        it(`unknown match`, () =>
            runTest({
                textWithPipe: `Unknown|Identifier`,
                expected: {
                    labels: [],
                    isTextEdit: false,
                },
            }));
    });

    describe(`getHover`, () => {
        function assertHoverAnalysis(params: {
            readonly textWithPipe: string;
            readonly expected: string | undefined;
        }): Promise<void> {
            return TestUtils.assertEqualHoverAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        it(`constant`, () =>
            assertHoverAnalysis({
                textWithPipe: `Test.Num|ber`,
                expected: `[library constant] Test.Number: number`,
            }));

        it(`function`, () =>
            assertHoverAnalysis({
                textWithPipe: `Test.Square|IfNumber`,
                expected: `[library function] Test.SquareIfNumber: (x: any) => any`,
            }));

        it(`no match`, () =>
            assertHoverAnalysis({
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

        it(`unknown identifier`, () =>
            assertSignatureHelp({
                textWithPipe: `Unknown|Identifier`,
                activeParameter: undefined,
            }));

        it(`first parameter, no literal`, () =>
            assertSignatureHelp({
                textWithPipe: `Test.SquareIfNumber(|`,
                activeParameter: 0,
            }));

        it(`first parameter, literal, no comma`, () =>
            assertSignatureHelp({
                textWithPipe: `Test.SquareIfNumber(1|`,
                activeParameter: 0,
            }));

        it(`first parameter, literal, comma`, () =>
            assertSignatureHelp({
                textWithPipe: `Test.SquareIfNumber(1,|`,
                activeParameter: 1,
            }));
    });
});
