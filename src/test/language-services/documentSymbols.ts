// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";
import { DocumentSymbol, SymbolKind, TextDocument } from "../../language-services";

import * as DocumentSymbols from "../../language-services/documentSymbols";
import * as InspectionUtils from "../../language-services/inspectionUtils";
import * as WorkspaceCache from "../../language-services/workspaceCache";
import * as Utils from "./utils";

function getLexAndParseOk(document: TextDocument): PQP.Task.LexParseOk {
    const triedLexParse: PQP.Task.TriedLexParse = WorkspaceCache.getTriedLexParse(document);
    if (PQP.ResultUtils.isErr(triedLexParse)) {
        throw new Error("AssertFailed: triedLexParse to be Ok");
    }
    return triedLexParse.value;
}

interface ExpectedDocumentSymbol {
    name: string;
    kind: SymbolKind;
}

function documentSymbolArrayToExpectedSymbols(documentSymbols: DocumentSymbol[]): ExpectedDocumentSymbol[] {
    const expectedSymbols: ExpectedDocumentSymbol[] = [];
    documentSymbols.forEach(element => {
        expectedSymbols.push({ name: element.name, kind: element.kind });
    });
    return expectedSymbols;
}

// Used to test symbols at a specific level of inspection
function expectSymbolsForNode(node: PQP.Language.Ast.TNode, expectedSymbols: ExpectedDocumentSymbol[]): void {
    let actualSymbols: ExpectedDocumentSymbol[];

    if (node.kind === PQP.Language.Ast.NodeKind.Section) {
        const result: DocumentSymbol[] = InspectionUtils.getSymbolsForSection(node);
        actualSymbols = documentSymbolArrayToExpectedSymbols(result);
    } else if (node.kind === PQP.Language.Ast.NodeKind.LetExpression) {
        const result: DocumentSymbol[] = InspectionUtils.getSymbolsForLetExpression(node);
        actualSymbols = documentSymbolArrayToExpectedSymbols(result);
    } else {
        throw new Error("unsupported code path");
    }

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.");
}

// Used to check entire symbol heirarchy returned by getDocumentSymbols()
function expectSymbolsForDocument(document: TextDocument, expectedSymbols: ExpectedDocumentSymbol[]): void {
    const actualSymbols: ExpectedDocumentSymbol[] = documentSymbolArrayToExpectedSymbols(
        DocumentSymbols.getDocumentSymbols(document),
    );

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.");
}

describe("Document symbol base functions", () => {
    it(`section foo; shared a = 1; b = "abc"; c = true;`, () => {
        const document: Utils.MockDocument = Utils.documentFromText(`section foo; shared a = 1; b = "abc"; c = true;`);
        const lexAndParseOk: PQP.Task.LexParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Language.Ast.NodeKind.Section);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Boolean },
        ]);
    });

    it(`section foo; a = {1,2};`, () => {
        const document: Utils.MockDocument = Utils.documentFromText(`section foo; a = {1,2};`);
        const lexAndParseOk: PQP.Task.LexParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Language.Ast.NodeKind.Section);

        expectSymbolsForNode(lexAndParseOk.ast, [{ name: "a", kind: SymbolKind.Array }]);
    });

    it(`let a = 1, b = 2, c = 3 in c`, () => {
        const document: Utils.MockDocument = Utils.documentFromText(`let a = 1, b = 2, c = 3 in c`);
        const lexAndParseOk: PQP.Task.LexParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Language.Ast.NodeKind.LetExpression);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.Number },
            { name: "c", kind: SymbolKind.Number },
        ]);
    });

    it("HelloWorldWithDocs file section", () => {
        const document: Utils.MockDocument = Utils.documentFromFile("HelloWorldWithDocs.pq");
        const lexAndParseOk: PQP.Task.LexParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Language.Ast.NodeKind.Section);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            { name: "HelloWorldImpl", kind: SymbolKind.Function },
            { name: "HelloWorldWithDocs", kind: SymbolKind.Struct },
            { name: "HelloWorldWithDocs.Publish", kind: SymbolKind.Struct },
        ]);
    });

    it("DirectQueryForSQL file section", () => {
        const document: Utils.MockDocument = Utils.documentFromFile("DirectQueryForSQL.pq");
        const lexAndParseOk: PQP.Task.LexParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Language.Ast.NodeKind.Section);

        expectSymbolsForNode(lexAndParseOk.ast, [
            { name: "DirectSQL.Database", kind: SymbolKind.Function },
            { name: "DirectSQL", kind: SymbolKind.Struct },
            { name: "DirectSQL.UI", kind: SymbolKind.Struct },
            { name: "DirectSQL.Icons", kind: SymbolKind.Struct },
        ]);
    });
});

describe("getDocumentSymbols", () => {
    it(`section foo; shared a = 1;`, () => {
        const document: Utils.MockDocument = Utils.documentFromText(`section foo; shared a = 1;`);

        expectSymbolsForDocument(document, [
            { name: "a", kind: SymbolKind.Number },
            { name: "a", kind: SymbolKind.Variable },
        ]);
    });
});
