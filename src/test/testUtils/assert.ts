// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as PQP from "@microsoft/powerquery-parser";
import * as TestUtils from "./testUtils";

import { Assert } from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import { CompletionItem, Hover, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";

import * as TestConstants from "../testConstants";

import { WorkspaceCache, WorkspaceCacheUtils } from "../../powerquery-language-services";
import { MockDocument } from "../mockDocument";

export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);
    return value;
}

export function assertGetInspectionCacheItemOk(document: MockDocument, position: Position): PQP.Inspection.Inspection {
    const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCacheUtils.getTriedInspection(
        document,
        position,
        TestConstants.SimpleExternalTypeResolver,
        undefined,
    );
    assertIsDefined(cacheItem);
    assertInspectionCacheItemOk(cacheItem);
    return cacheItem.value;
}

export function assertHover(expected: string, actual: Hover): void {
    const contents: string = assertAsMarkupContent(actual.contents).value;
    expect(contents).to.equal(expected);
}

export function assertIsDefined<T>(maybeValue: T | undefined): asserts maybeValue is NonNullable<T> {
    Assert.isDefined(maybeValue);
}

export function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

export function assertCompletionItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<CompletionItem>,
): void {
    const actualLabels: ReadonlyArray<string> = actual.map((item: CompletionItem) => item.label);
    expect(actualLabels).to.include.members(expected);
}

export function assertCacheItemOk<T, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.CacheItemOk<T, Stage> & WorkspaceCache.TCacheItem {
    if (cacheItem.kind !== PQP.ResultKind.Ok) {
        throw assert.fail(`cacheItem was expected to be an Ok`);
    }
}

export function assertCacheItemErr<E, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.CacheItemErr<E, Stage> & WorkspaceCache.TCacheItem {
    if (cacheItem.kind !== PQP.ResultKind.Err) {
        throw assert.fail(`cacheItem was expected to be an Err`);
    }
}

export function assertInspectionCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.InspectionCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Inspection.Inspection, WorkspaceCache.CacheStageKind.Inspection> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Inspection);
}

export function assertIsCacheItemStageEqual<T, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
    expectedStage: WorkspaceCache.CacheStageKind,
): asserts cacheItem is WorkspaceCache.TCacheItem & WorkspaceCache.CacheItemOk<T, Stage> {
    if (cacheItem.stage !== expectedStage) {
        throw assert.fail(`cacheItem.stage !== expectedStage`);
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

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.createAbridgedSignatureHelp(actual)).deep.equals(expected);
}
