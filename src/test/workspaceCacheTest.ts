// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";
import type { Position } from "vscode-languageserver-types";

import * as PQLS from "../powerquery-language-services";
import { TextDocument, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { SimpleLibrary } from "./testConstants";
import { TestUtils } from ".";

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

    it("getOrCreateParse", async () => {
        const text: string = "let c = 1 in c";

        const cacheItem: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemOk(cacheItem);
    });

    it("getOrCreateParse with error", async () => {
        const text: string = "let c = 1, in c";

        const cacheItem: WorkspaceCache.ParseCacheItem = await WorkspaceCacheUtils.getOrCreateParse(
            TestUtils.createTextMockDocument(text),
            PQP.DefaultSettings,
        );

        TestUtils.assertParserCacheItemError(cacheItem);
    });

    it("getOrCreateInspection", async () => {
        const [document, postion]: [MockDocument, Position] =
            TestUtils.createMockDocumentAndPosition("let c = 1 in |c");

        const cacheItem: WorkspaceCache.CacheItem | undefined = await WorkspaceCacheUtils.getOrCreateInspection(
            document,
            PQLS.InspectionUtils.createInspectionSettings(
                PQP.DefaultSettings,
                undefined,
                SimpleLibrary.externalTypeResolver,
            ),
            postion,
        );

        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
    });

    it("getOrCreateInspection with parser error", async () => {
        const [document, postion]: [MockDocument, Position] =
            TestUtils.createMockDocumentAndPosition("let c = 1, in |");

        const cacheItem: WorkspaceCache.CacheItem | undefined = await WorkspaceCacheUtils.getOrCreateInspection(
            document,
            PQLS.InspectionUtils.createInspectionSettings(
                PQP.DefaultSettings,
                undefined,
                SimpleLibrary.externalTypeResolver,
            ),
            postion,
        );

        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
    });

    it("cache invalidation with version change", async () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition("foo|");

        let cacheItem: WorkspaceCache.CacheItem | undefined = await WorkspaceCacheUtils.getOrCreateInspection(
            document,
            PQLS.InspectionUtils.createInspectionSettings(
                PQP.DefaultSettings,
                undefined,
                SimpleLibrary.externalTypeResolver,
            ),
            postion,
        );

        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
        expect(cacheItem.version === 1);

        document.setText("bar");

        cacheItem = await WorkspaceCacheUtils.getOrCreateInspection(
            document,
            PQLS.InspectionUtils.createInspectionSettings(
                PQP.DefaultSettings,
                undefined,
                SimpleLibrary.externalTypeResolver,
            ),
            postion,
        );

        TestUtils.assertIsDefined(cacheItem);
        TestUtils.assertInspectionCacheItemOk(cacheItem);
        expect(cacheItem.version === 2);
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
