// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as PQLS from "../powerquery-language-services";

import { expect } from "chai";
import "mocha";
import type { Position } from "vscode-languageserver-types";

import { TestUtils } from ".";
import { TextDocument, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { SimpleLibrary } from "./testConstants";

describe("workspaceCache", () => {
    it("getOrCreateLex", () => {
        const text: string = `let\n   b = 1\n   in b`;
        const cacheItem: WorkspaceCache.LexCacheItem = WorkspaceCacheUtils.getOrCreateLex(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );
        TestUtils.assertLexerCacheItemOk(cacheItem);
        expect(cacheItem.lexerSnapshot.lineTerminators.length).to.equal(3);
    });

    it("getOrCreateParse", () => {
        const text: string = "let c = 1 in c";
        const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );
        TestUtils.assertParserCacheItemOk(cacheItem);
    });

    it("getOrCreateParse with error", () => {
        const text: string = "let c = 1, in c";
        const cacheItem: WorkspaceCache.ParseCacheItem = WorkspaceCacheUtils.getOrCreateParse(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );
        TestUtils.assertParserCacheItemError(cacheItem);
    });

    it("getOrCreateInspection", () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
            "let c = 1 in |c",
        );
        const cacheItem: WorkspaceCache.CacheItem | undefined = WorkspaceCacheUtils.getOrCreateInspection(
            document,
            PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings, SimpleLibrary.externalTypeResolver),
            postion,
        );
        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
    });

    it("getOrCreateInspection with parser error", () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
            "let c = 1, in |",
        );
        const cacheItem: WorkspaceCache.CacheItem | undefined = WorkspaceCacheUtils.getOrCreateInspection(
            document,
            PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings, SimpleLibrary.externalTypeResolver),
            postion,
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
