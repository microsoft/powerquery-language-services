// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    Assert,
    CommonError,
    DefaultLocale,
    ExpiredCancellationToken,
    Result,
    ResultUtils,
} from "@microsoft/powerquery-parser";
import { expect } from "chai";

import type {
    Analysis,
    AnalysisSettings,
    Hover,
    Inspection,
    Library,
    Position,
    SignatureHelp,
} from "../powerquery-language-services";
import type { AutocompleteItem, TypeCache } from "../powerquery-language-services/inspection";
import { ILibraryProvider, ILocalDocumentProvider } from "../powerquery-language-services/providers/commonTypes";
import { TestConstants, TestUtils } from ".";
import { ILibrary } from "../powerquery-language-services/library/library";
import { SlowLibraryProvider } from "./providers/slowLibraryProvider";
import { SlowLocalDocumentProvider } from "./providers/slowLocalDocumentProvider";

describe(`Analysis`, () => {
    describe(`getAutocompleteItems;`, () => {
        it(`prefer local over library`, async () => {
            const autocompleteItems: Inspection.AutocompleteItem[] | undefined =
                await TestUtils.assertAutocompleteAnalysis(
                    `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                    TestConstants.SimpleLibraryAnalysisSettings,
                );

            Assert.isDefined(autocompleteItems);

            const autocompleteItem: AutocompleteItem = Assert.asDefined(
                autocompleteItems.find(
                    (item: AutocompleteItem) => item.label === TestConstants.TestLibraryName.SquareIfNumber,
                ),
            );

            expect(autocompleteItem.jaroWinklerScore).to.equal(1);
            expect(autocompleteItem.label === TestConstants.TestLibraryName.SquareIfNumber);
            expect(autocompleteItem.documentation).to.equal(undefined, `local definition should have no documentation`);
        });
    });

    describe(`getHoverItem`, () => {
        it(`prefer local over library`, async () =>
            await TestUtils.assertEqualHoverAnalysis(
                `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                `[let-variable] Test.SquareIfNumber: logical`,
                TestConstants.SimpleLibraryAnalysisSettings,
            ));

        it(`timeout library provider`, async () => {
            await runHoverTimeoutTest(`library`);
        });

        it(`timeout local document provider`, async () => {
            await runHoverTimeoutTest(`local`);
        });
    });

    describe(`getSignatureHelp`, () => {
        it(`prefer local over library`, async () =>
            await TestUtils.assertEqualSignatureHelpAnalysis(
                `let ${TestConstants.TestLibraryName.SquareIfNumber} = (str as text) as text => str in ${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                {
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
                TestConstants.SimpleLibraryAnalysisSettings,
            ));

        it(`timeout`, async () => {
            const analysisSettings: AnalysisSettings = {
                ...TestConstants.SimpleLibraryAnalysisSettings,
                libraryProviderFactory: (library: Library.ILibrary) =>
                    new SlowLibraryProvider(library, DefaultLocale, 100),
            };

            const [analysis, position]: [Analysis, Position] = TestUtils.assertAnalysisAndPositionFromText(
                `${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                analysisSettings,
            );

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

    const [analysis, position]: [Analysis, Position] = TestUtils.assertAnalysisAndPositionFromText(
        `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
        analysisSettings,
    );

    const hover: Result<Hover | undefined, CommonError.CommonError> = await analysis.getHover(
        position,
        ExpiredCancellationToken,
    );

    ResultUtils.assertIsError(hover);
    Assert.isTrue(hover.error.innerError instanceof CommonError.CancellationError);
}
