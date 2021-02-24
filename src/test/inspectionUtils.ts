// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as PQP from "@microsoft/powerquery-parser";

import { assert, expect } from "chai";
import "mocha";

import * as TestUtils from "./testUtils";

import { InspectionUtils, SymbolKind, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { AbridgedDocumentSymbol } from "./testUtils";

// Used to test symbols at a specific level of inspection
function expectSymbolsForNode(
    node: PQP.Language.Ast.TNode,
    expectedSymbols: ReadonlyArray<AbridgedDocumentSymbol>,
): void {
    let actualSymbols: ReadonlyArray<AbridgedDocumentSymbol>;

    if (node.kind === PQP.Language.Ast.NodeKind.Section) {
        actualSymbols = TestUtils.createAbridgedDocumentSymbols(InspectionUtils.getSymbolsForSection(node));
    } else if (node.kind === PQP.Language.Ast.NodeKind.LetExpression) {
        actualSymbols = TestUtils.createAbridgedDocumentSymbols(InspectionUtils.getSymbolsForLetExpression(node));
    } else {
        throw new Error("unsupported code path");
    }

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.\n");
}

describe("Document symbol base functions", () => {
    it(`section foo; shared a = 1; b = "abc"; c = true;`, () => {
        const document: MockDocument = TestUtils.createTextMockDocument(
            `section foo; shared a = 1; b = "abc"; c = true;`,
        );
        const lexAndParseOk: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Boolean },
        ]);
    });

    it(`section foo; a = {1,2};`, () => {
        const document: MockDocument = TestUtils.createTextMockDocument(`section foo; a = {1,2};`);
        const lexAndParseOk: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [{ name: "a", kind: SymbolKind.Array }]);
    });

    it(`let a = 1, b = 2, c = 3 in c`, () => {
        const document: MockDocument = TestUtils.createTextMockDocument(`let a = 1, b = 2, c = 3 in c`);
        const lexAndParseOk: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.Number },
            { name: "c", kind: SymbolKind.Number },
        ]);
    });

    it("HelloWorldWithDocs file section", () => {
        const document: MockDocument = TestUtils.createFileMockDocument("HelloWorldWithDocs.pq");
        const lexAndParseOk: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            { name: "HelloWorldImpl", kind: SymbolKind.Function },
            { name: "HelloWorldWithDocs", kind: SymbolKind.Struct },
            { name: "HelloWorldWithDocs.Publish", kind: SymbolKind.Struct },
        ]);
    });

    it("DirectQueryForSQL file section", () => {
        const document: MockDocument = TestUtils.createFileMockDocument("DirectQueryForSQL.pq");
        const lexAndParseOk: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "DirectSQL.Database", kind: SymbolKind.Function },
            { name: "DirectSQL", kind: SymbolKind.Struct },
            { name: "DirectSQL.UI", kind: SymbolKind.Struct },
            { name: "DirectSQL.Icons", kind: SymbolKind.Struct },
        ]);
    });
});
