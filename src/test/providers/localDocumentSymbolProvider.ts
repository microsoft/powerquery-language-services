// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import {
    AnalysisOptions,
    CompletionItem,
    EmptyHover,
    EmptySignatureHelp,
    Hover,
    NullSymbolProvider,
    SignatureHelp,
} from "../../powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { ILibrary } from "../../powerquery-language-services/library/library";
import * as TestConstants from "../testConstants";
import * as TestUtils from "../testUtils";

const IsolatedAnalysisOptions: AnalysisOptions = {
    ...TestConstants.SimpleLibraryAnalysisOptions,
    createLanguageCompletionItemProviderFn: () => NullSymbolProvider.singleton(),
    createLibrarySymbolProviderFn: (_library: ILibrary) => NullSymbolProvider.singleton(),
};

async function createCompletionItems(text: string): Promise<ReadonlyArray<CompletionItem>> {
    return TestUtils.createCompletionItems(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

async function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

async function createSignatureHelp(text: string): Promise<SignatureHelp> {
    return TestUtils.createSignatureHelp(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

describe(`SimpleLocalDocumentSymbolProvider`, async () => {
    describe(`getCompletionItems`, async () => {
        describe(`let`, async () => {
            it(`WIP match all`, async () => {
                const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];
                const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                    "let foo = 1, bar = 2, foobar = 3 in |",
                );
                TestUtils.assertCompletionItemLabels(expected, actual);
            });

            it(`limit matches`, async () => {
                const expected: ReadonlyArray<string> = ["foo", "foobar"];
                const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                    "let foo = 1, bar = 2, foobar = 3 in foo|",
                );
                TestUtils.assertCompletionItemLabels(expected, actual);
            });
        });
    });

    // describe(`getHover`, async () => {
    //     it(`match`, async () => {
    //         const hover: Hover = await createHover("Test.Num|ber");
    //         TestUtils.assertHover("[library constant] Test.Number: number", hover);
    //     });
    // });

    // describe(`getSignatureHelp`, async () => {
    //     it(`match, no parameter`, async () => {
    //         const actual: SignatureHelp = await createSignatureHelp("Unknown|Identifier");
    //         const expected: TestUtils.AbridgedSignatureHelp = {
    //             // tslint:disable-next-line: no-null-keyword
    //             activeParameter: null,
    //             activeSignature: 0,
    //         };
    //         TestUtils.assertSignatureHelp(expected, actual);
    //     });
    // });
});
