// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from ".";
import {
    AnalysisSettings,
    AutocompleteItemProviderContext,
    Hover,
    HoverProviderContext,
    Library,
    LibrarySymbolProvider,
    SignatureHelp,
    SignatureProviderContext,
} from "../powerquery-language-services";
import type { AutocompleteItem } from "../powerquery-language-services/inspection";
import { ILibrary } from "../powerquery-language-services/library/library";

class SlowSymbolProvider extends LibrarySymbolProvider {
    private readonly delayInMS: number;

    constructor(library: ILibrary, delayInMS: number) {
        super(library);
        this.delayInMS = delayInMS;
    }

    public override async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<AutocompleteItem>> {
        await this.delay();
        return super.getAutocompleteItems(context);
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        await this.delay();
        return super.getHover(context);
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        await this.delay();
        return super.getSignatureHelp(context);
    }

    private async delay(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, this.delayInMS);
        });
    }
}

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

        it(`timeout`, () => {
            const analysisSettings: AnalysisSettings = {
                ...TestConstants.SimpleLibraryAnalysisSettings,
                maybeCreateLibrarySymbolProviderFn: (library: Library.ILibrary) => new SlowSymbolProvider(library, 200),
                // maybeCreateLocalDocumentSymbolProviderFn: (
                //     _library: Library.ILibrary,
                //     _maybeTriedInspection: WorkspaceCache.CacheItem | undefined,
                //     _createInspectionSettingsFn: () => InspectionSettings,
                // ) => new SlowSymbolProvider(5000),
            };

            const startTime: number = new Date().getTime();

            return TestUtils.createHover(`${TestConstants.TestLibraryName.SquareIfNumber}|`, analysisSettings).then(
                hover => {
                    const stopTime: number = new Date().getTime();
                    TestUtils.assertHover(`[library function] Test.SquareIfNumber: (x: any) => any`, hover);

                    const totalMS: number = stopTime - startTime;
                    console.warn(`total time:[${totalMS}ms]`);
                    expect(totalMS).to.be.lessThanOrEqual(1000, `Test took longer than expected. [${totalMS}ms]`);
                },
            );
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
