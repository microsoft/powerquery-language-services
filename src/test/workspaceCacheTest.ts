// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Position } from "vscode-languageserver-types";

import * as PQLS from "../powerquery-language-services";

import { TestUtils } from ".";
import { TextDocument, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { SimpleLibrary } from "./testConstants";

describe("workspaceCache", () => {
    it("getLexerState", () => {
        const document: TextDocument = TestUtils.createTextMockDocument("let\n   b = 1\n   in b");
        const cacheItem: WorkspaceCache.LexCacheItem = WorkspaceCacheUtils.getLexerState(document, undefined);
        TestUtils.assertLexerCacheItemOk(cacheItem);
        expect(cacheItem.lexerSnapshot.lineTerminators.length).to.equal(3);
    });

    it("getTriedLexParse", () => {
        const document: TextDocument = TestUtils.createTextMockDocument("let c = 1 in c");
        const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemOk(cacheItem);
    });

    it("getTriedLexParse with error", () => {
        const document: TextDocument = TestUtils.createTextMockDocument("let c = 1, in c");
        const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        TestUtils.assertParserCacheItemError(cacheItem);
    });

    it("getInspection", () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
            "let c = 1 in |c",
        );
        const cacheItem: WorkspaceCache.CacheItem | undefined = WorkspaceCacheUtils.getTriedInspection(
            document,
            postion,
            SimpleLibrary.externalTypeResolver,
            undefined,
        );
        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
    });

    it("getInspection with parser error", () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
            "let c = 1, in |",
        );
        const cacheItem: WorkspaceCache.CacheItem | undefined = WorkspaceCacheUtils.getTriedInspection(
            document,
            postion,
            SimpleLibrary.externalTypeResolver,
            undefined,
        );
        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
    });
});

describe("top level workspace functions", () => {
    it("document operations", () => {
        const document: TextDocument = TestUtils.createTextMockDocument("let c = 1 in c");
        PQLS.documentUpdated(document, [], document.version + 1);
        PQLS.documentUpdated(document, [], document.version + 2);
        PQLS.documentClosed(document);
        PQLS.documentClosed(document);
        PQLS.documentUpdated(document, [], document.version);
    });
});
