// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from ".";
import { AnalysisSettings, Hover, SignatureHelp } from "../powerquery-language-services";
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
    });

    describe(`getHoverItems`, () => {
        it(`prefer local over library`, async () => {
            const hover: Hover = await TestUtils.createHover(
                `let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`,
            );
            TestUtils.assertHover(`[let-variable] Test.SquareIfNumber: logical`, hover);
        });

        it(`timeout`, async () => {
            const analysisSettings: AnalysisSettings = {
                ...TestConstants.SimpleLibraryAnalysisSettings,
                maybeCreateLocalDocumentSymbolProviderFn: (
                    library,
                    _maybeTriedInspection,
                    _createInspectionSettingsFn,
                ) => new SlowSymbolProvider(library, 1000),
            };

            const startTime: number = new Date().getTime();

            const hover: Hover = await TestUtils.createHover(
                `${TestConstants.TestLibraryName.SquareIfNumber}|`,
                analysisSettings,
            );

            const stopTime: number = new Date().getTime();
            const totalMS: number = stopTime - startTime;

            TestUtils.assertHover(`[library function] Test.SquareIfNumber: (x: any) => any`, hover);

            expect(totalMS).to.be.lessThanOrEqual(500, `Did we timeout the hover request? [${totalMS}ms]`);
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
    });
});
