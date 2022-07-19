// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import { DocumentUri } from "vscode-languageserver-textdocument";
import { expect } from "chai";

import {
    AnalysisSettings,
    Hover,
    Inspection,
    InspectionSettings,
    Library,
    SignatureHelp,
} from "../powerquery-language-services";
import { ILocalDocumentProvider, ISymbolProvider } from "../powerquery-language-services/providers/commonTypes";
import { TestConstants, TestUtils } from ".";
import type { AutocompleteItem } from "../powerquery-language-services/inspection";
import { SlowSymbolProvider } from "./providers/slowSymbolProvider";

describe("Analysis", () => {
    describe(`getAutocompleteItems;`, () => {
        it(`prefer local over library`, async () => {
            const autocompleteItems: ReadonlyArray<AutocompleteItem> = await TestUtils.createAutocompleteItems(`
        let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`);

            const autocompleteItem: AutocompleteItem = Assert.asDefined(
                autocompleteItems.find(
                    (item: AutocompleteItem) => item.label === TestConstants.TestLibraryName.SquareIfNumber,
                ),
            );

            expect(autocompleteItem.jaroWinklerScore).to.equal(1);
            expect(autocompleteItem.label === TestConstants.TestLibraryName.SquareIfNumber);
            expect(autocompleteItem.documentation).to.equal(undefined, "local definition should have no documentation");
        });

        it(`timeout providers`, async () => {
            const analysisSettings: AnalysisSettings = {
                ...TestConstants.SimpleLibraryAnalysisSettings,
                symbolProviderTimeoutInMS: 0, // immediate timeout
                maybeCreateLocalDocumentProviderFn: (
                    library: Library.ILibrary,
                    _uri: DocumentUri,
                    _maybePromiseInspected: Promise<Inspection.Inspected | undefined>,
                    _inspectionSettings: InspectionSettings,
                ) => new SlowSymbolProvider(library, 1000),
                maybeCreateLibrarySymbolProviderFn: (library: Library.ILibrary) =>
                    new SlowSymbolProvider(library, 1000),
            };

            const autocompleteItems: ReadonlyArray<AutocompleteItem> = await TestUtils.createAutocompleteItems(
                `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
                analysisSettings,
            );

            // TODO: The keyword/autocomplete provider runs synchronously and doesn't timeout.
            const autocompleteItem: AutocompleteItem | undefined = autocompleteItems.find(
                (item: AutocompleteItem) => item.label === TestConstants.TestLibraryName.SquareIfNumber,
            );

            expect(autocompleteItem).equals(undefined, "Didn't expect to find symbol");
        });
    });

    describe(`getHoverItems`, () => {
        it(`prefer local over library`, async () => {
            const hover: Hover = await TestUtils.createHover(
                `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
            );

            TestUtils.assertEqualHover(`[let-variable] Test.SquareIfNumber: logical`, hover);
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
            const actual: SignatureHelp = await TestUtils.createSignatureHelp(
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
                symbolProviderTimeoutInMS: 0, // immediate timeout
                maybeCreateLibrarySymbolProviderFn: (library: Library.ILibrary) =>
                    new SlowSymbolProvider(library, 1000),
            };

            const signatureHelp: SignatureHelp = await TestUtils.createSignatureHelp(
                `${TestConstants.TestLibraryName.SquareIfNumber}(|`,
                analysisSettings,
            );

            expect(signatureHelp.activeParameter).equals(undefined, "Didn't expect to find symbol");
            expect(signatureHelp.signatures.length).equals(0, "Didn't expect to find symbol");
        });
    });
});

async function runHoverTimeoutTest(provider: "local" | "library", expectedHoverText: string): Promise<void> {
    let maybeCreateLocalDocumentProviderFn: AnalysisSettings["maybeCreateLocalDocumentProviderFn"];
    let maybeCreateLibrarySymbolProviderFn: AnalysisSettings["maybeCreateLibrarySymbolProviderFn"];

    switch (provider) {
        case "library":
            maybeCreateLibrarySymbolProviderFn = (library: Library.ILibrary): ISymbolProvider =>
                new SlowSymbolProvider(library, 1000);

            maybeCreateLocalDocumentProviderFn =
                TestConstants.SimpleLibraryAnalysisSettings.maybeCreateLocalDocumentProviderFn;

            break;

        case "local":
            maybeCreateLibrarySymbolProviderFn =
                TestConstants.SimpleLibraryAnalysisSettings.maybeCreateLibrarySymbolProviderFn;

            maybeCreateLocalDocumentProviderFn = (
                library: Library.ILibrary,
                _uri: DocumentUri,
                _promiseMaybeInspected: Promise<Inspection.Inspected | undefined>,
                _inspectionSettings: InspectionSettings,
            ): ILocalDocumentProvider => new SlowSymbolProvider(library, 1000);

            break;

        default:
            throw Assert.isNever(provider);
    }

    const analysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        maybeCreateLibrarySymbolProviderFn,
        maybeCreateLocalDocumentProviderFn,
        symbolProviderTimeoutInMS: 10,
    };

    const startTime: number = new Date().getTime();

    const hover: Hover = await TestUtils.createHover(
        `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
        analysisSettings,
    );

    const stopTime: number = new Date().getTime();
    const totalMS: number = stopTime - startTime;

    TestUtils.assertEqualHover(expectedHoverText, hover);

    expect(totalMS).to.be.lessThanOrEqual(500, `Did we timeout the hover request? [${totalMS}ms]`);
}
