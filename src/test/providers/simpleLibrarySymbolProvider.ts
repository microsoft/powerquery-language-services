// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import {
    AnalysisOptions,
    WorkspaceCache,
    NullSymbolProvider,
    CompletionItem,
    Hover,
    SignatureHelp,
} from "../../powerquery-language-services";

import * as TestConstants from "../testConstants";
import * as TestUtils from "../testUtils";
import { ILibrary } from "../../powerquery-language-services/library/library";

const IsolatedAnalysisOptions: AnalysisOptions = {
    ...TestConstants.SimpleLibraryAnalysisOptions,
    createLocalDocumentSymbolProviderFn: (
        _library: ILibrary,
        _maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined,
    ) => NullSymbolProvider.singleton(),
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

describe(`SimpleLibraryProvider`, async () => {
    describe(`getCompletionItems`, async () => {
        it(`match`, async () => {
            const actual: ReadonlyArray<CompletionItem> = await createCompletionItems("Test.NumberO|");
            const expected: 
        });
    });
});
