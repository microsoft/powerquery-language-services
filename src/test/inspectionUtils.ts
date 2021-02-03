// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import * as InspectionUtils from "../powerquery-language-services/inspectionUtils";
import * as WorkspaceCache from "../powerquery-language-services/workspaceCache";
import * as TestUtils from "./testUtils";

import { SymbolKind } from "../powerquery-language-services";
import { ExpectedDocumentSymbol } from "./testUtils";

// Used to test symbols at a specific level of inspection
function expectSymbolsForNode(
    node: PQP.Language.Ast.TNode,
    expectedSymbols: ReadonlyArray<ExpectedDocumentSymbol>,
): void {
    let actualSymbols: ReadonlyArray<ExpectedDocumentSymbol>;

    if (node.kind === PQP.Language.Ast.NodeKind.Section) {
        actualSymbols = TestUtils.documentSymbolArrayToExpectedSymbols(InspectionUtils.getSymbolsForSection(node));
    } else if (node.kind === PQP.Language.Ast.NodeKind.LetExpression) {
        actualSymbols = TestUtils.documentSymbolArrayToExpectedSymbols(
            InspectionUtils.getSymbolsForLetExpression(node),
        );
    } else {
        throw new Error("unsupported code path");
    }

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.\n");
}

describe("Document symbol base functions", () => {
    it(`section foo; shared a = 1; b = "abc"; c = true;`, () => {
        const document: TestUtils.MockDocument = TestUtils.documentFromText(
            `section foo; shared a = 1; b = "abc"; c = true;`,
        );
        const lexAndParseOk: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.value.root, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Boolean },
        ]);
    });

    it(`section foo; a = {1,2};`, () => {
        const document: TestUtils.MockDocument = TestUtils.documentFromText(`section foo; a = {1,2};`);
        const lexAndParseOk: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.value.root, [{ name: "a", kind: SymbolKind.Array }]);
    });

    it(`let a = 1, b = 2, c = 3 in c`, () => {
        const document: TestUtils.MockDocument = TestUtils.documentFromText(`let a = 1, b = 2, c = 3 in c`);
        const lexAndParseOk: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.value.root, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.Number },
            { name: "c", kind: SymbolKind.Number },
        ]);
    });

    it("HelloWorldWithDocs file section", () => {
        const document: TestUtils.MockDocument = TestUtils.documentFromFile("HelloWorldWithDocs.pq");
        const lexAndParseOk: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.value.root, [
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            { name: "HelloWorldImpl", kind: SymbolKind.Function },
            { name: "HelloWorldWithDocs", kind: SymbolKind.Struct },
            { name: "HelloWorldWithDocs.Publish", kind: SymbolKind.Struct },
        ]);
    });

    it("DirectQueryForSQL file section", () => {
        const document: TestUtils.MockDocument = TestUtils.documentFromFile("DirectQueryForSQL.pq");
        const lexAndParseOk: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(lexAndParseOk);

        expectSymbolsForNode(lexAndParseOk.value.root, [
            { name: "DirectSQL.Database", kind: SymbolKind.Function },
            { name: "DirectSQL", kind: SymbolKind.Struct },
            { name: "DirectSQL.UI", kind: SymbolKind.Struct },
            { name: "DirectSQL.Icons", kind: SymbolKind.Struct },
        ]);
    });
});
