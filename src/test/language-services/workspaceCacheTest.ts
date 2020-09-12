// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import * as LanguageServices from "../../language-services";
import { TextDocument } from "../../language-services";
import * as WorkspaceCache from "../../language-services/workspaceCache";
import * as Utils from "./utils";

function assertGetCacheItemOk<T, E, Stage extends WorkspaceCache.CacheStageKind>(
    cacheItem: WorkspaceCache.ICacheItem<T, E, Stage> & WorkspaceCache.TCacheItem,
): T {
    if (cacheItem.result.kind === PQP.ResultKind.Err) {
        assert.fail(`cacheItem expected to be Ok`);
    }
    return cacheItem.result.value as T;
}

describe("workspaceCache", () => {
    it("getLexerState", () => {
        const document: TextDocument = Utils.documentFromText("let\n   b = 1\n   in b");
        const cacheItem: WorkspaceCache.LexerCacheItem = WorkspaceCache.getLexerState(document, undefined);
        const lexState: PQP.Lexer.State = assertGetCacheItemOk(cacheItem);
        expect(lexState.lines.length).to.equal(3);
    });

    it("getTriedLexerSnapshot", () => {
        const document: TextDocument = Utils.documentFromText("let a = 1 in a");
        const cacheItem: WorkspaceCache.TLexerSnapshotCacheItem = WorkspaceCache.getTriedLexerSnapshot(
            document,
            undefined,
        );
        const lexerSnapshot: PQP.Lexer.LexerSnapshot = assertGetCacheItemOk<
            PQP.Lexer.LexerSnapshot,
            PQP.Lexer.LexError.TLexError,
            any
        >(cacheItem);
        // PQP.Assert.isOk(cacheItem);
        assertCacheItemOk(cacheItem.result);
        assertIsOk<PQP.Lexer.State | PQP.Lexer.LexerSnapshot, PQP.Lexer.LexError.TLexError>(cacheItem.result);

        // if (PQP.ResultUtils.isOk(triedSnapshot)) {
        //     const snapshot: PQP.LexerSnapshot = triedSnapshot.value;
        //     expect(snapshot.tokens.length).to.equal(6);
        // } else {
        //     assert.fail("triedSnapshot should be OK");
        // }
    });

    it("getTriedLexParse", () => {
        const document: TextDocument = Utils.documentFromText("let c = 1 in c");
        const triedLexParse: PQP.Task.TriedLexParse = WorkspaceCache.getTriedParse(document, undefined);
        assert.isDefined(triedLexParse);
        if (PQP.ResultUtils.isOk(triedLexParse)) {
            const lexParseOk: PQP.Task.LexParseOk = triedLexParse.value;
            assert.isDefined(lexParseOk.root);
        } else {
            assert.fail("triedLexParse should be OK");
        }
    });

    it("getTriedLexParse with error", () => {
        const document: TextDocument = Utils.documentFromText("let c = 1, in c");
        const triedLexParse: PQP.Task.TriedLexParse = WorkspaceCache.getTriedParse(document, undefined);
        assert.isDefined(triedLexParse);
        expect(triedLexParse.kind).to.equal(PQP.ResultKind.Err);
    });

    it("getInspection", () => {
        const [document, postion] = Utils.documentAndPositionFrom("let c = 1 in |c");
        const triedInspect: PQP.Task.TriedInspection | undefined = WorkspaceCache.maybeTriedInspection(
            document,
            postion,
            undefined,
        );
        if (triedInspect) {
            expect(triedInspect.kind).to.equal(PQP.ResultKind.Ok);
        } else {
            assert.isDefined(triedInspect);
        }
    });

    it("getInspection with parser error", () => {
        const [document, postion] = Utils.documentAndPositionFrom("let c = 1, in |");
        const triedInspect: PQP.Task.TriedInspection | undefined = WorkspaceCache.maybeTriedInspection(
            document,
            postion,
            undefined,
        );
        if (triedInspect) {
            expect(triedInspect.kind).to.equal(PQP.ResultKind.Ok);
        } else {
            assert.isDefined(triedInspect);
        }
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
