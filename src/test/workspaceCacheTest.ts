// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import { Position } from "vscode-languageserver-types";
import * as LanguageServices from "../powerquery-language-services";
import { TextDocument, WorkspaceCache, WorkspaceCacheUtils } from "../powerquery-language-services";
import { MockDocument } from "./mockDocument";
import { SimpleLibrary } from "./testConstants";
import * as TestUtils from "./testUtils";

function assertCacheItemOk<T, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.CacheItemOk<T, Stage> & WorkspaceCache.TCacheItem {
    if (cacheItem.kind !== PQP.ResultKind.Ok) {
        throw assert.fail(`cacheItem was expected to be an Ok`);
    }
}

function assertIsCacheItemStageEqual<T, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
    expectedStage: WorkspaceCache.CacheStageKind,
): asserts cacheItem is WorkspaceCache.TCacheItem & WorkspaceCache.CacheItemOk<T, Stage> {
    if (cacheItem.stage !== expectedStage) {
        throw assert.fail(`cacheItem.stage !== expectedStage`);
    }
}

export function assertCacheItemErr<E, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.CacheItemErr<E, Stage> & WorkspaceCache.TCacheItem {
    if (cacheItem.kind !== PQP.ResultKind.Err) {
        throw assert.fail(`cacheItem was expected to be an Err`);
    }
}

export function assertLexerCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.LexerCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Lexer.State, WorkspaceCache.CacheStageKind.Lexer> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Lexer);
}

export function assertLexerSnapshotCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.LexerSnapshotCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Lexer.LexerSnapshot, WorkspaceCache.CacheStageKind.LexerSnapshot> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.LexerSnapshot);
}

export function assertParserCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.ParserCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Parser.ParseOk, WorkspaceCache.CacheStageKind.Parser> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Parser);
}

export function assertParserCacheItemErr(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.ParserCacheItem &
    WorkspaceCache.CacheItemErr<PQP.Parser.ParseError.TParseError, WorkspaceCache.CacheStageKind.Parser> {
    assertCacheItemErr(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Parser);
}

export function assertInspectionCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.InspectionCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Inspection.Inspection, WorkspaceCache.CacheStageKind.Inspection> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Inspection);
}

export function assertGetInspectionCacheItemOk(document: MockDocument, position: Position): PQP.Inspection.Inspection {
    const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCacheUtils.getTriedInspection(
        document,
        position,
        SimpleLibrary.externalTypeResolver,
        undefined,
    );
    TestUtils.assertIsDefined(cacheItem);
    assertInspectionCacheItemOk(cacheItem);
    return cacheItem.value;
}

describe("workspaceCache", () => {
    it("getLexerState", () => {
        const document: TextDocument = TestUtils.documentFromText("let\n   b = 1\n   in b");
        const cacheItem: WorkspaceCache.LexerCacheItem = WorkspaceCacheUtils.getLexerState(document, undefined);
        assertLexerCacheItemOk(cacheItem);
        expect(cacheItem.value.lines.length).to.equal(3);
    });

    it("getTriedLexerSnapshot", () => {
        const document: TextDocument = TestUtils.documentFromText("let a = 1 in a");
        const cacheItem: WorkspaceCache.TLexerSnapshotCacheItem = WorkspaceCacheUtils.getTriedLexerSnapshot(
            document,
            undefined,
        );
        assertLexerSnapshotCacheItemOk(cacheItem);
        expect(cacheItem.value.tokens.length).to.equal(6);
    });

    it("getTriedLexParse", () => {
        const document: TextDocument = TestUtils.documentFromText("let c = 1 in c");
        const cacheItem: WorkspaceCache.TParserCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        assertParserCacheItemOk(cacheItem);
    });

    it("getTriedLexParse with error", () => {
        const document: TextDocument = TestUtils.documentFromText("let c = 1, in c");
        const cacheItem: WorkspaceCache.TParserCacheItem = WorkspaceCacheUtils.getTriedParse(document, undefined);
        assertParserCacheItemErr(cacheItem);
    });

    it("getInspection", () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.documentAndPositionFrom("let c = 1 in |c");
        const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCacheUtils.getTriedInspection(
            document,
            postion,
            SimpleLibrary.externalTypeResolver,
            undefined,
        );
        TestUtils.assertIsDefined(cacheItem);
        assertInspectionCacheItemOk(cacheItem);
    });

    it("getInspection with parser error", () => {
        const [document, postion]: [MockDocument, Position] = TestUtils.documentAndPositionFrom("let c = 1, in |");
        const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCacheUtils.getTriedInspection(
            document,
            postion,
            SimpleLibrary.externalTypeResolver,
            undefined,
        );
        TestUtils.assertIsDefined(cacheItem);
        assertInspectionCacheItemOk(cacheItem);
    });
});

describe("top level workspace functions", () => {
    it("document operations", () => {
        const document: TextDocument = TestUtils.documentFromText("let c = 1 in c");
        LanguageServices.documentUpdated(document, [], document.version + 1);
        LanguageServices.documentUpdated(document, [], document.version + 2);
        LanguageServices.documentClosed(document);
        LanguageServices.documentClosed(document);
        LanguageServices.documentUpdated(document, [], document.version);
    });
});
