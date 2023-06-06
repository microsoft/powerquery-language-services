// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { SignatureInformation } from "vscode-languageserver-types";

import { AnalysisSettings, NullSymbolProvider } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { ILibrary } from "../../powerquery-language-services/library/library";
import { TypeCache } from "../../powerquery-language-services/inspection";

describe(`SimpleLibraryProvider`, () => {
    const IsolatedAnalysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        localDocumentProviderFactory: (_uri: string, _typeCache: TypeCache, _library: ILibrary) =>
            NullSymbolProvider.singleton(),
    };

    describe(`getAutocompleteItems`, () => {
        async function assertContainsAutocompleteAnalysis(
            textWithPipe: string,
            expected: ReadonlyArray<string>,
        ): Promise<void> {
            await TestUtils.assertContainsAutocompleteAnalysis(textWithPipe, expected, IsolatedAnalysisSettings);
        }

        it(`match`, async () => {
            await assertContainsAutocompleteAnalysis(`Test.NumberO|`, [TestConstants.TestLibraryName.NumberOne]);
        });

        it(`match multiple`, async () =>
            await assertContainsAutocompleteAnalysis(`Test.Numbe|`, [
                TestConstants.TestLibraryName.Number,
                TestConstants.TestLibraryName.NumberOne,
            ]));

        it(`unknown match`, async () => await assertContainsAutocompleteAnalysis(`Unknown|Identifier`, []));
    });

    describe(`getHover`, () => {
        async function assertHoverAnalysis(textWithPipe: string, expected: string | undefined): Promise<void> {
            await TestUtils.assertEqualHoverAnalysis(textWithPipe, expected, IsolatedAnalysisSettings);
        }

        it(`constant`, async () => await assertHoverAnalysis(`Test.Num|ber`, `[library constant] Test.Number: number`));

        it(`function`, async () =>
            await assertHoverAnalysis(
                `Test.Square|IfNumber`,
                `[library function] Test.SquareIfNumber: (x: any) => any`,
            ));

        it(`no match`, async () => await assertHoverAnalysis(`Unknown|Identifier`, undefined));
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

        async function assertSignatureHelp(textWithPipe: string, activeParameter?: number): Promise<void> {
            await TestUtils.assertEqualSignatureHelpAnalysis(
                textWithPipe,
                activeParameter !== undefined
                    ? {
                          activeParameter,
                          activeSignature: 0,
                          signatures: [squareIfNumberSignatureInformation],
                      }
                    : undefined,
                IsolatedAnalysisSettings,
            );
        }

        it(`unknown identifier`, async () => await assertSignatureHelp(`Unknown|Identifier`, undefined));

        it(`first parameter, no literal`, async () => await assertSignatureHelp(`Test.SquareIfNumber(|`, 0));

        it(`first parameter, literal, no comma`, async () => await assertSignatureHelp(`Test.SquareIfNumber(1|`, 0));

        it(`first parameter, literal, comma`, async () => await assertSignatureHelp(`Test.SquareIfNumber(1,|`, 1));
    });
});
