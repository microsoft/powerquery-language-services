// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { TextDocument, TextDocumentContentChangeEvent } from "./commonTypes";

export const enum CacheStageKind {
    Lexer,
    LexerSnapshot,
    Parser,
    Inspection,
}

export type TCacheItem = LexerCacheItem | LexerSnapshotCacheItem | ParserCacheItem | InspectionCacheItem;

export type LexerCacheItem = CacheItem<PQP.Lexer.TriedLex, CacheStageKind.Lexer>;

export type TLexerSnapshotCacheItem = LexerSnapshotCacheItem | LexerCacheItem;
export type LexerSnapshotCacheItem = CacheItem<PQP.Lexer.TriedLexerSnapshot, CacheStageKind.LexerSnapshot>;

export type TParserCacheItem = ParserCacheItem | TLexerSnapshotCacheItem;
export type ParserCacheItem = CacheItem<PQP.Parser.TriedParse, CacheStageKind.Parser>;

export type TInspectionCacheItem = InspectionCacheItem | TParserCacheItem;
export type InspectionCacheItem = CacheItem<PQP.Inspection.TriedInspection, CacheStageKind.Inspection>;

// TODO: is the position key valid for a single intellisense operation,
// or would it be the same for multiple invocations?
export function close(textDocument: TextDocument): void {
    AllCaches.forEach(map => {
        map.delete(textDocument.uri);
    });
}

export function update(textDocument: TextDocument, _changes: TextDocumentContentChangeEvent[], _version: number): void {
    // TODO: support incremental lexing
    // TODO: premptively prepare cache on background thread?
    // TODO: use document version
    close(textDocument);
}

export function getLexerState(textDocument: TextDocument, locale: string | undefined): LexerCacheItem {
    return getOrCreate(LexerStateCache, textDocument, locale, createLexerCacheItem);
}

export function getTriedLexerSnapshot(textDocument: TextDocument, locale: string | undefined): TLexerSnapshotCacheItem {
    return getOrCreate(LexerSnapshotCache, textDocument, locale, createLexerSnapshotCacheItem);
}

export function getTriedParse(textDocument: TextDocument, locale: string | undefined): TParserCacheItem {
    return getOrCreate(ParserCache, textDocument, locale, createParserCacheItem);
}

// We can't easily reuse getOrCreate because inspections require a position argument.
// This results in a double layer cache.
export function getTriedInspection(
    textDocument: TextDocument,
    position: PQP.Inspection.Position,
    locale: string | undefined,
): TInspectionCacheItem | undefined {
    const cacheKey: string = textDocument.uri;
    const maybePositionCache: undefined | InspectionMap = InspectionCache.get(cacheKey);

    let positionCache: WeakMap<PQP.Inspection.Position, TInspectionCacheItem>;
    // document has been inspected before
    if (maybePositionCache !== undefined) {
        positionCache = maybePositionCache;
    } else {
        positionCache = new WeakMap();
        InspectionCache.set(textDocument.uri, positionCache);
    }

    if (positionCache.has(position)) {
        return positionCache.get(position);
    } else {
        const value: TInspectionCacheItem | undefined = createTriedInspection(textDocument, position, locale);
        positionCache.set(position, value);
        return value;
    }
}

// Notice that the value type for WeakMap includes undefined.
// Take the scenario where an inspection was requested on a document that was not parsable,
// then createTriedInspection would return undefined as you can't inspect something that wasn't parsed.
// If we used WeakMap.get(...) we wouldn't know if an undefined was returned because of a cache miss
// or that we we couldn't do an inspection.
type InspectionMap = WeakMap<PQP.Inspection.Position, TInspectionCacheItem>;

const LexerStateCache: Map<string, LexerCacheItem> = new Map();
const LexerSnapshotCache: Map<string, TLexerSnapshotCacheItem> = new Map();
const ParserCache: Map<string, TParserCacheItem> = new Map();
const InspectionCache: Map<string, InspectionMap> = new Map();

const AllCaches: Map<string, any>[] = [LexerSnapshotCache, LexerStateCache, ParserCache, InspectionCache];
interface CacheItem<T, Stage extends CacheStageKind> {
    readonly result: T;
    readonly stage: Stage;
}

function getOrCreate<T>(
    cache: Map<string, T>,
    textDocument: TextDocument,
    locale: string | undefined,
    factoryFn: (textDocument: TextDocument, locale: string | undefined) => T,
): T {
    const cacheKey: string = textDocument.uri;
    const maybeValue: T | undefined = cache.get(cacheKey);

    if (maybeValue === undefined) {
        const value: T = factoryFn(textDocument, locale);
        cache.set(cacheKey, value);
        return value;
    } else {
        return maybeValue;
    }
}

function createLexerCacheItem(textDocument: TextDocument, locale: string | undefined): LexerCacheItem {
    return {
        result: PQP.Lexer.tryLex(getSettings(locale), textDocument.getText()),
        stage: CacheStageKind.Lexer,
    };
}

function createLexerSnapshotCacheItem(textDocument: TextDocument, locale: string | undefined): TLexerSnapshotCacheItem {
    const lexerCacheItem: LexerCacheItem = getLexerState(textDocument, locale);
    const triedLex: PQP.Lexer.TriedLex = lexerCacheItem.result;
    if (PQP.ResultUtils.isErr(triedLex)) {
        return lexerCacheItem;
    }
    const lexerState: PQP.Lexer.State = triedLex.value;

    return {
        result: PQP.Lexer.trySnapshot(lexerState),
        stage: CacheStageKind.LexerSnapshot,
    };
}

function createParserCacheItem(textDocument: TextDocument, locale: string | undefined): TParserCacheItem {
    const lexerSnapshotCacheItem: TLexerSnapshotCacheItem = getTriedLexerSnapshot(textDocument, locale);
    if (
        lexerSnapshotCacheItem.stage !== CacheStageKind.LexerSnapshot ||
        PQP.ResultUtils.isErr(lexerSnapshotCacheItem.result)
    ) {
        return lexerSnapshotCacheItem;
    }
    const lexerSnapshot: PQP.Lexer.LexerSnapshot = lexerSnapshotCacheItem.result.value;

    const settings: PQP.ParseSettings = {
        ...PQP.DefaultSettings,
        ...getSettings(locale),
    };
    const triedParse: PQP.Parser.TriedParse = PQP.Task.tryParse(
        PQP.Parser.IParserStateUtils.stateFactory(settings, lexerSnapshot),
        settings.parser,
    );
    return {
        result: triedParse,
        stage: CacheStageKind.Parser,
    };
}

// We're allowed to return undefined because if a document wasn't parsed
// then there's no way to perform an inspection.
function createTriedInspection(
    textDocument: TextDocument,
    position: PQP.Inspection.Position,
    locale: string | undefined,
): TInspectionCacheItem {
    const parserCacheItem: TParserCacheItem = getTriedParse(textDocument, locale);
    if (parserCacheItem.stage !== CacheStageKind.Parser) {
        return parserCacheItem;
    }

    return {
        result: PQP.Task.tryInspection(getSettings(locale), parserCacheItem.result, position),
        stage: CacheStageKind.Inspection,
    };
}

function getSettings(locale: string | undefined): PQP.CommonSettings {
    return {
        ...PQP.DefaultSettings,
        locale: locale != undefined ? locale : PQP.DefaultSettings.locale,
    };
}
