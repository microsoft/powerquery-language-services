// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { Analysis, AnalysisUtils, DocumentSymbol, SymbolKind } from "../powerquery-language-services";
import { TestConstants, TestUtils } from ".";
import { AbridgedDocumentSymbol } from "./testUtils";

// Used to check entire symbol heirarchy returned by getDocumentSymbols()
async function assertSymbolsForDocument(
    text: string,
    expectedSymbols: ReadonlyArray<AbridgedDocumentSymbol>,
): Promise<void> {
    const analysis: Analysis = AnalysisUtils.createAnalysis(
        TestUtils.mockDocument(text),
        TestConstants.SimpleLibraryAnalysisSettings,
    );

    const actualSymbols: Result<DocumentSymbol[] | undefined, CommonError.CommonError> =
        await analysis.getDocumentSymbols(TestConstants.NoOpCancellationTokenInstance);

    Assert.isOk(actualSymbols);
    Assert.isDefined(actualSymbols.value);

    const abridgedActualSymbols: ReadonlyArray<AbridgedDocumentSymbol> = TestUtils.abridgedDocumentSymbols(
        actualSymbols.value,
    );

    expect(abridgedActualSymbols).deep.equals(
        expectedSymbols,
        `Expected document symbols to match.\nExpected:${JSON.stringify(expectedSymbols)}\nActual:${JSON.stringify(
            abridgedActualSymbols,
        )}`,
    );
}

describe("getDocumentSymbols", () => {
    it(`section foo; shared a = 1;`, async () => {
        await assertSymbolsForDocument(`section foo; shared a = 1;`, [{ name: "a", kind: SymbolKind.Number }]);
    });

    it(`section foo; shared query = let a = 1 in a;`, async () => {
        await assertSymbolsForDocument(`section foo; shared query = let a = 1 in a;`, [
            { name: "query", kind: SymbolKind.Variable, children: [{ name: "a", kind: SymbolKind.Number }] },
        ]);
    });

    it(`let a = 1, b = "hello", c = () => 1 in c`, async () => {
        await assertSymbolsForDocument(`let a = 1, b = "hello", c = () => 1 in c`, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Function },
        ]);
    });

    it(`let a = let b = 1, c = let d = 1 in d in c in a`, async () => {
        await assertSymbolsForDocument(`let a = let b = 1, c = let d = 1 in d in c in a`, [
            {
                name: "a",
                kind: SymbolKind.Variable,
                children: [
                    { name: "b", kind: SymbolKind.Number },
                    { name: "c", kind: SymbolKind.Variable, children: [{ name: "d", kind: SymbolKind.Number }] },
                ],
            },
        ]);
    });

    // with syntax error
    it(`section foo; shared a = 1; b = "hello"; c = let a1`, async () => {
        await assertSymbolsForDocument(`section foo; shared a = 1; b = "hello"; c = let a1`, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
        ]);
    });

    it(`HelloWorldWithDocs.pq`, async () => {
        await assertSymbolsForDocument(TestUtils.readFile(`HelloWorldWithDocs.pq`), [
            // HelloWorldWithDocs.Contents comes back as a Variable because of the use of Value.ReplaceType
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            {
                name: "HelloWorldImpl",
                kind: SymbolKind.Function,
                children: [
                    { name: "_count", kind: SymbolKind.Variable },
                    { name: "listOfMessages", kind: SymbolKind.Variable },
                    { name: "table", kind: SymbolKind.Variable },
                ],
            },
            {
                name: "HelloWorldWithDocs",
                kind: SymbolKind.Struct,
                children: [{ name: "Authentication", kind: SymbolKind.Field }],
            },
            {
                name: "HelloWorldWithDocs.Publish",
                kind: SymbolKind.Struct,
                children: [
                    { name: "Beta", kind: SymbolKind.Field },
                    { name: "Category", kind: SymbolKind.Field },
                    { name: "ButtonText", kind: SymbolKind.Field },
                ],
            },
        ]);
    });
});
