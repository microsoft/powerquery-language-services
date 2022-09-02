// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { Analysis, AnalysisUtils, DocumentSymbol, SymbolKind, TextDocument } from "../powerquery-language-services";
import { TestConstants, TestUtils } from ".";
import { AbridgedDocumentSymbol } from "./testUtils";
import { MockDocument } from "./mockDocument";

// Used to check entire symbol heirarchy returned by getDocumentSymbols()
async function expectSymbolsForDocument(
    document: TextDocument,
    expectedSymbols: ReadonlyArray<AbridgedDocumentSymbol>,
): Promise<void> {
    const analysis: Analysis = AnalysisUtils.createAnalysis(document, TestConstants.SimpleLibraryAnalysisSettings);

    const actualSymbols: Result<DocumentSymbol[] | undefined, CommonError.CommonError> =
        await analysis.getDocumentSymbols(TestConstants.NoOpCancellationTokenInstance);

    Assert.isOk(actualSymbols);
    Assert.isDefined(actualSymbols.value);

    const abridgedActualSymbols: ReadonlyArray<AbridgedDocumentSymbol> = TestUtils.createAbridgedDocumentSymbols(
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
        const document: MockDocument = TestUtils.createTextMockDocument(`section foo; shared a = 1;`);

        await expectSymbolsForDocument(document, [{ name: "a", kind: SymbolKind.Number }]);
    });

    it(`section foo; shared query = let a = 1 in a;`, async () => {
        const document: MockDocument = TestUtils.createTextMockDocument(`section foo; shared query = let a = 1 in a;`);

        await expectSymbolsForDocument(document, [
            { name: "query", kind: SymbolKind.Variable, maybeChildren: [{ name: "a", kind: SymbolKind.Number }] },
        ]);
    });

    it(`let a = 1, b = "hello", c = () => 1 in c`, async () => {
        const document: MockDocument = TestUtils.createTextMockDocument(`let a = 1, b = "hello", c = () => 1 in c`);

        await expectSymbolsForDocument(document, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Function },
        ]);
    });

    it(`let a = let b = 1, c = let d = 1 in d in c in a`, async () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            `let a = let b = 1, c = let d = 1 in d in c in a`,
        );

        await expectSymbolsForDocument(document, [
            {
                name: "a",
                kind: SymbolKind.Variable,
                maybeChildren: [
                    { name: "b", kind: SymbolKind.Number },
                    { name: "c", kind: SymbolKind.Variable, maybeChildren: [{ name: "d", kind: SymbolKind.Number }] },
                ],
            },
        ]);
    });

    // with syntax error
    it(`section foo; shared a = 1; b = "hello"; c = let a1`, async () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            `section foo; shared a = 1; b = "hello"; c = let a1`,
        );

        await expectSymbolsForDocument(document, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
        ]);
    });

    it(`HelloWorldWithDocs.pq`, async () => {
        const document: MockDocument = TestUtils.createFileMockDocument("HelloWorldWithDocs.pq");

        await expectSymbolsForDocument(document, [
            // HelloWorldWithDocs.Contents comes back as a Variable because of the use of Value.ReplaceType
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            {
                name: "HelloWorldImpl",
                kind: SymbolKind.Function,
                maybeChildren: [
                    { name: "_count", kind: SymbolKind.Variable },
                    { name: "listOfMessages", kind: SymbolKind.Variable },
                    { name: "table", kind: SymbolKind.Variable },
                ],
            },
            {
                name: "HelloWorldWithDocs",
                kind: SymbolKind.Struct,
                maybeChildren: [{ name: "Authentication", kind: SymbolKind.Field }],
            },
            {
                name: "HelloWorldWithDocs.Publish",
                kind: SymbolKind.Struct,
                maybeChildren: [
                    { name: "Beta", kind: SymbolKind.Field },
                    { name: "Category", kind: SymbolKind.Field },
                    { name: "ButtonText", kind: SymbolKind.Field },
                ],
            },
        ]);
    });
});
