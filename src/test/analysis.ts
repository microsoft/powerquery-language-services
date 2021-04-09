// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from ".";
import { Hover, SignatureHelp } from "../powerquery-language-services";
import type { AutocompleteItem } from "../powerquery-language-services/inspection";

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
    });

    describe(`getHoverItems`, () => {
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
