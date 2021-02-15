// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from ".";
import { CompletionItem } from "../powerquery-language-services";

describe("Analysis", () => {
    describe(`WIP getCompletionItems;`, async () => {
        it(`prefer local over library`, async () => {
            const completionItems: ReadonlyArray<CompletionItem> = await TestUtils.createCompletionItems(`
        let ${TestConstants.TestLibraryName.SquareIfNumber} = true in ${TestConstants.TestLibraryName.SquareIfNumber}|`);

            expect(completionItems.length).to.equal(1);
            const completionItem: CompletionItem = Assert.asDefined(completionItems[0]);
            expect(completionItem.label === TestConstants.TestLibraryName.SquareIfNumber);
            expect(completionItem.documentation).to.equal(undefined, "local definition should have no documentation");
        });
    });
});
