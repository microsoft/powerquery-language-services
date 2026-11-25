// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    Assert,
    CommonError,
    DefaultLocale,
    ExpiredCancellationToken,
    NoOpCancellationToken,
    Result,
    ResultUtils,
} from "@microsoft/powerquery-parser";
import { Mock, mock } from "node:test";
import { CompletionItemKind } from "vscode-languageserver-types";
import { expect } from "chai";

import type { Analysis, AnalysisSettings, Hover, Inspection, Library, Position, SignatureHelp } from "../src";
import type { AutocompleteItem, TypeCache } from "../src/inspection";
import { FoldingRangeProviderContext, ILibraryProvider, ILocalDocumentProvider } from "../src/providers/commonTypes";
import { TestConstants, TestUtils } from ".";
import { ILibrary } from "../src/library/library";
import { LocalDocumentProvider } from "../src/providers";
import { SlowLibraryProvider } from "./providers/slowLibraryProvider.test";
import { SlowLocalDocumentProvider } from "./providers/slowLocalDocumentProvider.test";

describe(`Analysis`, () => {
    it("gives each request a fresh fifteen-second deadline, unless the caller overrides it", async () => {
        let now: number = 0;
        let elapsed: number = 0;
        const clock: Mock<typeof Date.now> = mock.method(Date, "now", () => now);
        const baseSettings: AnalysisSettings = TestConstants.SimpleLibraryAnalysisSettings;

        const analysisSettings: AnalysisSettings = {
            ...baseSettings,
            localDocumentProviderFactory: (
                uri: string,
                typeCache: TypeCache,
                library: ILibrary,
                locale: string,
            ): LocalDocumentProvider => {
                const provider: LocalDocumentProvider = new LocalDocumentProvider(uri, typeCache, library, locale);
                const getFoldingRanges: typeof provider.getFoldingRanges = provider.getFoldingRanges.bind(provider);

                provider.getFoldingRanges = (
                    context: FoldingRangeProviderContext,
                ): ReturnType<typeof getFoldingRanges> => {
                    now += elapsed;

                    return getFoldingRanges(context);
                };

                return provider;
            },
        };

        try {
            const analysis: Analysis = TestUtils.assertAnalysisFromText({ text: "[a = 1]", analysisSettings });
            ResultUtils.assertIsOk(await analysis.getParseState());
            now = 60_000;

            elapsed = 14_999;
            ResultUtils.assertIsOk(await analysis.getFoldingRanges());

            elapsed = 15_000;
            const timedOut: Awaited<ReturnType<Analysis["getFoldingRanges"]>> = await analysis.getFoldingRanges();
            ResultUtils.assertIsError(timedOut);
            expect(timedOut.error.innerError).to.be.instanceOf(CommonError.CancellationError);

            ResultUtils.assertIsOk(await analysis.getFoldingRanges(NoOpCancellationToken));
            elapsed = 0;
            ResultUtils.assertIsOk(await analysis.getFoldingRanges());
        } finally {
            clock.mock.restore();
        }
    });

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
                    (item: AutocompleteItem) =>
                        item.label === TestConstants.TestLibraryName.SquareIfNumber &&
                        item.kind === CompletionItemKind.Variable,
                ),
            );

            expect(autocompleteItem.jaroWinklerScore).to.equal(1);
            expect(autocompleteItem.label === TestConstants.TestLibraryName.SquareIfNumber);
            expect(autocompleteItem.documentation).to.equal(undefined, `local definition should have no documentation`);
        });

        describe(`trailing period`, () => {
            const testCases: ReadonlyArray<{
                readonly textWithPipe: string;
                readonly expectedLabel: string;
            }> = [
                {
                    textWithPipe: `Table.|`,
                    expectedLabel: `Table.AddColumn`,
                },
                {
                    textWithPipe: `Table.Ad|`,
                    expectedLabel: `Table.AddColumn`,
                },
                {
                    textWithPipe: `List.|`,
                    expectedLabel: `List.Transform`,
                },
                {
                    textWithPipe: `Record.|`,
                    expectedLabel: `Record.Field`,
                },
            ];

            for (const testCase of testCases) {
                it(testCase.textWithPipe, async () => {
                    const autocompleteItems: Inspection.AutocompleteItem[] | undefined =
                        await TestUtils.assertAutocompleteAnalysis({
                            textWithPipe: testCase.textWithPipe,
                            analysisSettings: TestConstants.StandardLibraryAnalysisSettings,
                        });

                    Assert.isDefined(autocompleteItems);

                    expect(autocompleteItems.some((item: AutocompleteItem) => item.label === testCase.expectedLabel)).to
                        .be.true;
                });
            }
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
