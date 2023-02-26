// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { AnalysisSettings, NullSymbolProvider, SignatureHelp } from "../../powerquery-language-services";
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
            await TestUtils.assertContainsAutocompleteAnalysis(expected, IsolatedAnalysisSettings, textWithPipe);
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
            await TestUtils.assertEqualHoverAnalysis(expected, IsolatedAnalysisSettings, textWithPipe);
        }

        it(`constant`, async () => await assertHoverAnalysis(`Test.Num|ber`, `[library constant] Test.Number: number`));

        it(`function`, async () =>
            await assertHoverAnalysis(
                `[library function] Test.SquareIfNumber: (x: any) => any`,
                `Test.Square|IfNumber`,
            ));

        it(`no match`, async () => await assertHoverAnalysis(`Unknown|Identifier`, undefined));
    });

    describe(`getSignatureHelp`, () => {
        async function assertSignatureHelp(textWithPipe: string, expected: SignatureHelp | undefined): Promise<void> {
            await TestUtils.assertEqualSignatureHelpAnalysis(expected, IsolatedAnalysisSettings, textWithPipe);
        }

        it(`unknown identifier`, async () => await assertSignatureHelp(`Unknown|Identifier`, undefined));

        it(`first parameter, no literal`, async () => await assertSignatureHelp(`Test.SquareIfNumber(|`, undefined));

        it(`first parameter, literal, no comma`, async () =>
            await assertSignatureHelp(`Test.SquareIfNumber(1|`, undefined));

        it(`first parameter, literal, comma`, async () =>
            await assertSignatureHelp(`Test.SquareIfNumber(1,|`, undefined));
    });
});
