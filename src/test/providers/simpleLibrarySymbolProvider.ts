// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";

import {
    AnalysisSettings,
    Hover,
    Inspection,
    NullSymbolProvider,
    SignatureHelp,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { ILibrary } from "../../powerquery-language-services/library/library";
import { TypeCache } from "../../powerquery-language-services/inspection";

const IsolatedAnalysisSettings: AnalysisSettings = {
    ...TestConstants.SimpleLibraryAnalysisSettings,
    localDocumentProviderFactory: (_uri: string, _typeCache: TypeCache, _library: ILibrary) =>
        NullSymbolProvider.singleton(),
};

function createAutocompleteItems(
    text: string,
): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
    return TestUtils.createAutocompleteItems(text, IsolatedAnalysisSettings);
}

function createHover(text: string): Promise<Result<Hover | undefined, CommonError.CommonError>> {
    return TestUtils.createHover(text, IsolatedAnalysisSettings);
}

function createSignatureHelp(text: string): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
    return TestUtils.createSignatureHelp(text, IsolatedAnalysisSettings);
}

describe(`SimpleLibraryProvider`, () => {
    describe(`getAutocompleteItems`, () => {
        it(`match`, async () => {
            const expected: ReadonlyArray<string> = [TestConstants.TestLibraryName.NumberOne];

            const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await createAutocompleteItems("Test.NumberO|");

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
        });

        it(`match multiple`, async () => {
            const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await createAutocompleteItems("Test.Numbe|");

            const expected: ReadonlyArray<string> = [
                TestConstants.TestLibraryName.Number,
                TestConstants.TestLibraryName.NumberOne,
            ];

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
        });

        it(`no match`, async () => {
            const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await createAutocompleteItems("Unknown|Identifier");

            const expected: ReadonlyArray<string> = [];
            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
        });
    });

    describe(`getHover`, () => {
        it(`constant`, async () => {
            const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("Test.Num|ber");
            Assert.isOk(hover);
            Assert.isDefined(hover.value);
            TestUtils.assertEqualHover("[library constant] Test.Number: number", hover.value);
        });

        it(`function`, async () => {
            const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("Test.Square|IfNumber");
            Assert.isOk(hover);
            Assert.isDefined(hover.value);
            TestUtils.assertEqualHover("[library function] Test.SquareIfNumber: (x: any) => any", hover.value);
        });

        it(`no match`, async () => {
            const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("Unknown|Identifier");
            Assert.isOk(hover);
            Assert.isUndefined(hover.value);
        });
    });

    describe(`getSignatureHelp`, () => {
        it(`unknown identifier`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> = await createSignatureHelp(
                "Unknown|Identifier",
            );

            Assert.isOk(actual);
            Assert.isUndefined(actual.value);
        });

        it(`first parameter, no literal`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> = await createSignatureHelp(
                "Test.SquareIfNumber(|",
            );

            const expected: TestUtils.AbridgedSignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
            };

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertSignatureHelp(expected, actual.value);
            Assert.isDefined(actual.value.signatures[0].documentation);
        });

        it(`first parameter, literal, no comma`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> = await createSignatureHelp(
                "Test.SquareIfNumber(1|",
            );

            const expected: TestUtils.AbridgedSignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
            };

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertSignatureHelp(expected, actual.value);
            Assert.isDefined(actual.value.signatures[0].documentation);
        });

        it(`first parameter, literal, comma`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> = await createSignatureHelp(
                "Test.SquareIfNumber(1,|",
            );

            const expected: TestUtils.AbridgedSignatureHelp = {
                activeParameter: 1,
                activeSignature: 0,
            };

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertSignatureHelp(expected, actual.value);
            Assert.isDefined(actual.value.signatures[0].documentation);
        });
    });
});
