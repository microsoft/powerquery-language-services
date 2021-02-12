// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import { assert, expect } from "chai";
import "mocha";

import * as DocumentSymbols from "../powerquery-language-services/documentSymbols";

import { TestUtils } from ".";
import { SymbolKind, TextDocument } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { AbridgedDocumentSymbol } from "./testUtils";

// Used to check entire symbol heirarchy returned by getDocumentSymbols()
function expectSymbolsForDocument(
    document: TextDocument,
    expectedSymbols: ReadonlyArray<AbridgedDocumentSymbol>,
): void {
    const actualSymbols: ReadonlyArray<AbridgedDocumentSymbol> = TestUtils.createAbridgedDocumentSymbols(
        DocumentSymbols.getDocumentSymbols(document),
    );

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(
        expectedSymbols,
        "Expected document symbols to match.\n" + JSON.stringify(actualSymbols),
    );
}

describe("getDocumentSymbols", () => {
    it(`section foo; shared a = 1;`, () => {
        const document: MockDocument = TestUtils.documentFromText(`section foo; shared a = 1;`);

        expectSymbolsForDocument(document, [{ name: "a", kind: SymbolKind.Number }]);
    });

    it(`section foo; shared query = let a = 1 in a;`, () => {
        const document: MockDocument = TestUtils.documentFromText(`section foo; shared query = let a = 1 in a;`);

        expectSymbolsForDocument(document, [
            { name: "query", kind: SymbolKind.Variable, maybeChildren: [{ name: "a", kind: SymbolKind.Number }] },
        ]);
    });

    it(`let a = 1, b = "hello", c = () => 1 in c`, () => {
        const document: MockDocument = TestUtils.documentFromText(`let a = 1, b = "hello", c = () => 1 in c`);

        expectSymbolsForDocument(document, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Function },
        ]);
    });

    it(`let a = let b = 1, c = let d = 1 in d in c in a`, () => {
        const document: MockDocument = TestUtils.documentFromText(`let a = let b = 1, c = let d = 1 in d in c in a`);

        expectSymbolsForDocument(document, [
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
    it(`section foo; shared a = 1; b = "hello"; c = let a1`, () => {
        const document: MockDocument = TestUtils.documentFromText(`section foo; shared a = 1; b = "hello"; c = let a1`);

        expectSymbolsForDocument(document, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
        ]);
    });

    it(`HelloWorldWithDocs.pq`, () => {
        const document: MockDocument = TestUtils.documentFromFile("HelloWorldWithDocs.pq");

        expectSymbolsForDocument(document, [
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
