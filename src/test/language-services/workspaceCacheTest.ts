// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";

import { Position } from "vscode-languageserver-types";
import * as LanguageServices from "../../powerquery-language-services";
import { TextDocument } from "../../powerquery-language-services";
import * as WorkspaceCache from "../../powerquery-language-services/workspaceCache";
import * as Utils from "./utils";

describe("workspaceCache", () => {
    it("getLexerState", () => {
        const document: TextDocument = Utils.documentFromText("let\n   b = 1\n   in b");
        const cacheItem: WorkspaceCache.LexerCacheItem = WorkspaceCache.getLexerState(document, undefined);
        Utils.assertLexerCacheItemOk(cacheItem);
        expect(cacheItem.value.lines.length).to.equal(3);
    });

    it("getTriedLexerSnapshot", () => {
        const document: TextDocument = Utils.documentFromText("let a = 1 in a");
        const cacheItem: WorkspaceCache.TLexerSnapshotCacheItem = WorkspaceCache.getTriedLexerSnapshot(
            document,
            undefined,
        );
        Utils.assertLexerSnapshotCacheItemOk(cacheItem);
        expect(cacheItem.value.tokens.length).to.equal(6);
    });

    it("getTriedLexParse", () => {
        const document: TextDocument = Utils.documentFromText("let c = 1 in c");
        const cacheItem: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        Utils.assertParserCacheItemOk(cacheItem);
    });

    it("getTriedLexParse with error", () => {
        const document: TextDocument = Utils.documentFromText("let c = 1, in c");
        const cacheItem: WorkspaceCache.TParserCacheItem = WorkspaceCache.getTriedParse(document, undefined);
        Utils.assertParserCacheItemErr(cacheItem);
    });

    it("getInspection", () => {
        const [document, postion]: [Utils.MockDocument, Position] = Utils.documentAndPositionFrom("let c = 1 in |c");
        const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCache.getTriedInspection(
            document,
            postion,
            undefined,
        );
        Utils.assertIsDefined(cacheItem);
        Utils.assertInspectionCacheItemOk(cacheItem);
    });

    it("getInspection with parser error", () => {
        const [document, postion]: [Utils.MockDocument, Position] = Utils.documentAndPositionFrom("let c = 1, in |");
        const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCache.getTriedInspection(
            document,
            postion,
            undefined,
        );
        Utils.assertIsDefined(cacheItem);
        Utils.assertInspectionCacheItemOk(cacheItem);
    });
});

describe("top level workspace functions", () => {
    it("document operations", () => {
        const document: TextDocument = Utils.documentFromText("let c = 1 in c");
        LanguageServices.documentUpdated(document, [], document.version + 1);
        LanguageServices.documentUpdated(document, [], document.version + 2);
        LanguageServices.documentClosed(document);
        LanguageServices.documentClosed(document);
        LanguageServices.documentUpdated(document, [], document.version);
    });
});
