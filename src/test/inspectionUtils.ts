// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import { Ast, AstUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import * as TestUtils from "./testUtils";
import { InspectionUtils, SymbolKind, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { AbridgedDocumentSymbol } from "./testUtils";
import { MockDocument } from "./mockDocument";

// Used to test symbols at a specific level of inspection
function expectSymbolsForNode(node: Ast.TNode, expectedSymbols: ReadonlyArray<AbridgedDocumentSymbol>): void {
    let actualSymbols: ReadonlyArray<AbridgedDocumentSymbol>;

    if (AstUtils.isSection(node)) {
        actualSymbols = TestUtils.createAbridgedDocumentSymbols(InspectionUtils.getSymbolsForSection(node));
    } else if (AstUtils.isLetExpression(node)) {
        actualSymbols = TestUtils.createAbridgedDocumentSymbols(InspectionUtils.getSymbolsForLetExpression(node));
    } else {
        throw new Error("unsupported code path");
    }

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.\n");
}

describe("Document symbol base functions", () => {
    it(`section foo; shared a = 1; b = "abc"; c = true;`, async () => {
        const testDocument: MockDocument = TestUtils.createTextMockDocument(
            `section foo; shared a = 1; b = "abc"; c = true;`,
        );

        const lexAndParseOk: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            testDocument,
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Boolean },
        ]);
    });

    it(`section foo; a = {1,2};`, async () => {
        const text: string = `section foo; a = {1,2};`;
        const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

        const lexAndParseOk: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            textDocument,
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [{ name: "a", kind: SymbolKind.Array }]);
    });

    it(`let a = 1, b = 2, c = 3 in c`, async () => {
        const text: string = `let a = 1, b = 2, c = 3 in c`;
        const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

        const lexAndParseOk: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            textDocument,
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.Number },
            { name: "c", kind: SymbolKind.Number },
        ]);
    });

    it("HelloWorldWithDocs file section", async () => {
        const text: string = TestUtils.readFile("HelloWorldWithDocs.pq");
        const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

        const lexAndParseOk: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            textDocument,
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            { name: "HelloWorldImpl", kind: SymbolKind.Function },
            { name: "HelloWorldWithDocs", kind: SymbolKind.Struct },
            { name: "HelloWorldWithDocs.Publish", kind: SymbolKind.Struct },
        ]);
    });

    it("DirectQueryForSQL file section", async () => {
        const text: string = TestUtils.readFile("DirectQueryForSQL.pq");
        const textDocument: MockDocument = TestUtils.createTextMockDocument(text);

        const lexAndParseOk: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            textDocument,
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "DirectSQL.Database", kind: SymbolKind.Function },
            { name: "DirectSQL", kind: SymbolKind.Struct },
            { name: "DirectSQL.UI", kind: SymbolKind.Struct },
            { name: "DirectSQL.Icons", kind: SymbolKind.Struct },
        ]);
    });
});
