// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import {
    AnalysisSettings,
    EmptyHover,
    EmptySignatureHelp,
    Hover,
    Inspection,
    NullSymbolProvider,
    SignatureHelp,
    WorkspaceCache,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { ILibrary } from "../../powerquery-language-services/library/library";

const IsolatedAnalysisSettings: AnalysisSettings = {
    ...TestConstants.SimpleLibraryAnalysisSettings,
    maybeCreateLocalDocumentSymbolProviderFn: (
        _library: ILibrary,
        _maybeTriedInspection: WorkspaceCache.CacheItem | undefined,
    ) => NullSymbolProvider.singleton(),
};

async function createAutocompleteItems(text: string): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    return TestUtils.createAutocompleteItems(text, IsolatedAnalysisSettings);
}

async function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, IsolatedAnalysisSettings);
}

async function createSignatureHelp(text: string): Promise<SignatureHelp> {
    return TestUtils.createSignatureHelp(text, IsolatedAnalysisSettings);
}

describe(`SimpleLibraryProvider`, async () => {
    describe(`getAutocompleteItems`, async () => {
        it(`match`, async () => {
            const expected: ReadonlyArray<string> = [TestConstants.TestLibraryName.NumberOne];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems("Test.NumberO|");
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`match multiple`, async () => {
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems("Test.Numbe|");

            const expected: ReadonlyArray<string> = [
                TestConstants.TestLibraryName.Number,
                TestConstants.TestLibraryName.NumberOne,
            ];

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`no match`, async () => {
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                "Unknown|Identifier",
            );

            const expected: ReadonlyArray<string> = [];
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`getHover`, async () => {
        it(`constant`, async () => {
            const hover: Hover = await createHover("Test.Num|ber");
            TestUtils.assertHover("[library constant] Test.Number: number", hover);
        });

        it(`function`, async () => {
            const hover: Hover = await createHover("Test.Square|IfNumber");
            TestUtils.assertHover("[library function] Test.SquareIfNumber: (x: any) => any", hover);
        });

        it(`no match`, async () => {
            const hover: Hover = await createHover("Unknown|Identifier");
            expect(hover).to.equal(EmptyHover);
        });
    });

    describe(`getSignatureHelp`, async () => {
        it(`unknown identifier`, async () => {
            const actual: SignatureHelp = await createSignatureHelp("Unknown|Identifier");
            expect(actual).to.equal(EmptySignatureHelp);
        });

        it(`first parameter, no literal`, async () => {
            const actual: SignatureHelp = await createSignatureHelp("Test.SquareIfNumber(|");

            const expected: TestUtils.AbridgedSignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
            };

            TestUtils.assertSignatureHelp(expected, actual);
            Assert.isDefined(actual.signatures[0].documentation);
        });

        it(`first parameter, literal, no comma`, async () => {
            const actual: SignatureHelp = await createSignatureHelp("Test.SquareIfNumber(1|");

            const expected: TestUtils.AbridgedSignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
            };

            TestUtils.assertSignatureHelp(expected, actual);
            Assert.isDefined(actual.signatures[0].documentation);
        });

        it(`first parameter, literal, comma`, async () => {
            const actual: SignatureHelp = await createSignatureHelp("Test.SquareIfNumber(1,|");

            const expected: TestUtils.AbridgedSignatureHelp = {
                activeParameter: 1,
                activeSignature: 0,
            };

            TestUtils.assertSignatureHelp(expected, actual);
            Assert.isDefined(actual.signatures[0].documentation);
        });
    });
});
