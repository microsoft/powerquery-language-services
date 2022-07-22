// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { AnalysisSettings, Hover, Inspection, Library, SignatureHelp } from "../powerquery-language-services";
import type { AutocompleteItem, TypeCache } from "../powerquery-language-services/inspection";
import { ILibraryProvider, ILocalDocumentProvider } from "../powerquery-language-services/providers/commonTypes";
import { TestConstants, TestUtils } from ".";
import { ILibrary } from "../powerquery-language-services/library/library";
import { SlowLibraryProvider } from "./providers/slowLibraryProvider";
import { SlowLocalDocumentProvider } from "./providers/slowLocalDocumentProvider";

describe("Analysis", () => {
    describe(`getAutocompleteItems;`, () => {
        it(`prefer local over library`, async () => {
            const autocompleteItems: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await TestUtils.createAutocompleteItems(`
        let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`);

            Assert.isOk(autocompleteItems);
            Assert.isDefined(autocompleteItems.value);

            const autocompleteItem: AutocompleteItem = Assert.asDefined(
                autocompleteItems.value.find(
                    (item: AutocompleteItem) => item.label === TestConstants.TestLibraryName.SquareIfNumber,
                ),
            );

            expect(autocompleteItem.jaroWinklerScore).to.equal(1);
            expect(autocompleteItem.label === TestConstants.TestLibraryName.SquareIfNumber);
            expect(autocompleteItem.documentation).to.equal(undefined, "local definition should have no documentation");
        });
    });

    describe(`getHoverItems`, () => {
        it(`prefer local over library`, async () => {
            const hover: Result<Hover | undefined, CommonError.CommonError> = await TestUtils.createHover(
                `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
            );

            Assert.isOk(hover);
            Assert.isDefined(hover.value);
            TestUtils.assertEqualHover(`[let-variable] Test.SquareIfNumber: logical`, hover.value);
        });

        it(`timeout library provider`, async () => {
            await runHoverTimeoutTest("library", `[let-variable] Test.SquareIfNumber: logical`);
        });

        it(`timeout local document provider`, async () => {
            await runHoverTimeoutTest("local", `[library function] Test.SquareIfNumber: (x: any) => any`);
        });
    });

    describe(`getSignatureHelp`, () => {
        it(`prefer local over library`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> =
                await TestUtils.createSignatureHelp(
                    `let ${TestConstants.TestLibraryName.SquareIfNumber} = (str as text) as text => str in ${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                );

            const expected: SignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
                signatures: [
                    {
                        label: `${TestConstants.TestLibraryName.SquareIfNumber}(str: text)`,
                        parameters: [
                            {
                                label: "str",
                            },
                        ],
                    },
                ],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`timeout`, async () => {
            const analysisSettings: AnalysisSettings = {
                ...TestConstants.SimpleLibraryAnalysisSettings,
                maybeCreateLibraryProviderFn: (library: Library.ILibrary) => new SlowLibraryProvider(library, 1000),
            };

            const signatureHelp: Result<SignatureHelp | undefined, CommonError.CommonError> =
                await TestUtils.createSignatureHelp(
                    `${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                    analysisSettings,
                );

            Assert.isOk(signatureHelp);
            Assert.isDefined(signatureHelp.value);
            expect(signatureHelp.value.activeParameter).equals(undefined, "Didn't expect to find symbol");
            expect(signatureHelp.value.signatures.length).equals(0, "Didn't expect to find symbol");
        });
    });
});

async function runHoverTimeoutTest(provider: "local" | "library", expectedHoverText: string): Promise<void> {
    let maybeCreateLocalDocumentProviderFn: AnalysisSettings["maybeCreateLocalDocumentProviderFn"];
    let maybeCreateLibraryProviderFn: AnalysisSettings["maybeCreateLibraryProviderFn"];

    switch (provider) {
        case "library":
            maybeCreateLibraryProviderFn = (library: Library.ILibrary): ILibraryProvider =>
                new SlowLibraryProvider(library, 1000);

            maybeCreateLocalDocumentProviderFn =
                TestConstants.SimpleLibraryAnalysisSettings.maybeCreateLocalDocumentProviderFn;

            break;

        case "local":
            maybeCreateLibraryProviderFn = TestConstants.SimpleLibraryAnalysisSettings.maybeCreateLibraryProviderFn;

            maybeCreateLocalDocumentProviderFn = (
                uri: string,
                typeCache: TypeCache,
                library: ILibrary,
            ): ILocalDocumentProvider => new SlowLocalDocumentProvider(uri, typeCache, library, 1000);

            break;

        default:
            throw Assert.isNever(provider);
    }

    const analysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        maybeCreateLibraryProviderFn,
        maybeCreateLocalDocumentProviderFn,
    };

    const startTime: number = new Date().getTime();

    const hover: Result<Hover | undefined, CommonError.CommonError> = await TestUtils.createHover(
        `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
        analysisSettings,
    );

    const stopTime: number = new Date().getTime();
    const totalMS: number = stopTime - startTime;

    Assert.isOk(hover);
    Assert.isDefined(hover.value);
    TestUtils.assertEqualHover(expectedHoverText, hover.value);

    expect(totalMS).to.be.lessThanOrEqual(500, `Did we timeout the hover request? [${totalMS}ms]`);
}
