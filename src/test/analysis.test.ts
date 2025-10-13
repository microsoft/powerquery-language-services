// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Assert,
    CommonError,
    DefaultLocale,
    ExpiredCancellationToken,
    type Result,
    ResultUtils,
} from "@microsoft/powerquery-parser";
import { describe, expect, it } from "bun:test";

import {
    type Analysis,
    type AnalysisSettings,
    type Hover,
    type Inspection,
    type Library,
    type Position,
    type SignatureHelp,
} from "../powerquery-language-services";
import { type AutocompleteItem, type TypeCache } from "../powerquery-language-services/inspection";
import {
    type ILibraryProvider,
    type ILocalDocumentProvider,
} from "../powerquery-language-services/providers/commonTypes";
import { TestConstants, TestUtils } from ".";
import { type ILibrary } from "../powerquery-language-services/library/library";
import { SlowLibraryProvider } from "./providers/slowLibraryProvider.test";
import { SlowLocalDocumentProvider } from "./providers/slowLocalDocumentProvider.test";

describe(`Analysis`, () => {
    describe(`getAutocompleteItems;`, () => {
        it(`prefer local over library`, async () => {
            const autocompleteItems: Inspection.AutocompleteItem[] | undefined =
                await TestUtils.assertAutocompleteAnalysis({
                    textWithPipe: `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                    analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
                });

            Assert.isDefined(autocompleteItems);

            const autocompleteItem: AutocompleteItem = Assert.asDefined(
                autocompleteItems.find(
                    (item: AutocompleteItem) => item.label === TestConstants.TestLibraryName.SquareIfNumber,
                ),
            );

            expect(autocompleteItem.jaroWinklerScore).toBe(1);
            expect(autocompleteItem.label === TestConstants.TestLibraryName.SquareIfNumber);
            expect(autocompleteItem.documentation).toBeUndefined(); // local definition should have no documentation
        });
    });

    describe(`getHoverItem`, () => {
        it(`prefer local over library`, async () =>
            await TestUtils.assertEqualHoverAnalysis({
                textWithPipe: `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                expected: `[let-variable] Test.SquareIfNumber: logical`,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            }));

        it(`timeout library provider`, async () => {
            await runHoverTimeoutTest(`library`);
        });

        it(`timeout local document provider`, async () => {
            await runHoverTimeoutTest(`local`);
        });
    });

    describe(`getSignatureHelp`, () => {
        it(`prefer local over library`, async () =>
            await TestUtils.assertEqualSignatureHelpAnalysis({
                textWithPipe: `let ${TestConstants.TestLibraryName.SquareIfNumber} = (str as text) as text => str in ${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                expected: {
                    activeParameter: 0,
                    activeSignature: 0,
                    signatures: [
                        {
                            label: `${TestConstants.TestLibraryName.SquareIfNumber}(str: text)`,
                            parameters: [
                                {
                                    label: `str`,
                                },
                            ],
                        },
                    ],
                },
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            }));

        it(`timeout`, async () => {
            const analysisSettings: AnalysisSettings = {
                ...TestConstants.SimpleLibraryAnalysisSettings,
                libraryProviderFactory: (library: Library.ILibrary) =>
                    new SlowLibraryProvider(library, DefaultLocale, 100),
            };

            const [analysis, position]: [Analysis, Position] = TestUtils.assertAnalysisAndPositionFromText({
                textWithPipe: `${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                analysisSettings,
            });

            const signatureHelp: Result<SignatureHelp | undefined, CommonError.CommonError> =
                await analysis.getSignatureHelp(position, ExpiredCancellationToken);

            ResultUtils.assertIsError(signatureHelp);
        });
    });
});

async function runHoverTimeoutTest(provider: `local` | `library`): Promise<void> {
    let libraryProviderFactory: AnalysisSettings[`libraryProviderFactory`];
    let localDocumentProviderFactory: AnalysisSettings[`localDocumentProviderFactory`];

    switch (provider) {
        case `library`:
            libraryProviderFactory = (library: Library.ILibrary): ILibraryProvider =>
                new SlowLibraryProvider(library, DefaultLocale, 10);

            localDocumentProviderFactory = TestConstants.SimpleLibraryAnalysisSettings.localDocumentProviderFactory;

            break;

        case `local`:
            libraryProviderFactory = TestConstants.SimpleLibraryAnalysisSettings.libraryProviderFactory;

            localDocumentProviderFactory = (
                uri: string,
                typeCache: TypeCache,
                library: ILibrary,
            ): ILocalDocumentProvider => new SlowLocalDocumentProvider(uri, typeCache, library, DefaultLocale, 10);

            break;

        default:
            throw Assert.isNever(provider);
    }

    const analysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        libraryProviderFactory,
        localDocumentProviderFactory,
    };

    const [analysis, position]: [Analysis, Position] = TestUtils.assertAnalysisAndPositionFromText({
        textWithPipe: `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
        analysisSettings,
    });

    const hover: Result<Hover | undefined, CommonError.CommonError> = await analysis.getHover(
        position,
        ExpiredCancellationToken,
    );

    ResultUtils.assertIsError(hover);
    Assert.isTrue(hover.error.innerError instanceof CommonError.CancellationError);
}
