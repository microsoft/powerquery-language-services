// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position, TextDocument, TextDocumentContentChangeEvent } from "./commonTypes";

const lexerStateCache: Map<string, LexerCacheItem> = new Map();
const lexerSnapshotCache: Map<string, TLexerSnapshotCacheItem> = new Map();
const triedLexParseCache: Map<string, TParserCacheItem> = new Map();
const triedInspectionCache: Map<string, InspectionMap> = new Map();

// Notice that the value type for WeakMap includes undefined.
// Take the scenario where an inspection was requested on a document that was not parsable,
// then createTriedInspection would return undefined as you can't inspect something that wasn't parsed.
// If we used WeakMap.get(...) we wouldn't know if an undefined was returned because of a cache miss
// or that we we couldn't do an inspection.
type InspectionMap = WeakMap<Position, TInspectionCacheItem>;

const allCaches: Map<string, any>[] = [lexerSnapshotCache, lexerStateCache, triedLexParseCache, triedInspectionCache];

// TODO: is the position key valid for a single intellisense operation,
// or would it be the same for multiple invocations?
export function close(textDocument: TextDocument): void {
    allCaches.forEach(map => {
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
    return getOrCreate(lexerStateCache, textDocument, locale, createLexerCacheItem);
}

export function getTriedLexerSnapshot(textDocument: TextDocument, locale: string | undefined): TLexerSnapshotCacheItem {
    return getOrCreate(lexerSnapshotCache, textDocument, locale, createLexerSnapshotCacheItem);
}

export function getTriedLexParse(textDocument: TextDocument, locale: string | undefined): TParserCacheItem {
    return getOrCreate(triedLexParseCache, textDocument, locale, createParserCacheItem);
}

// We can't easily reuse getOrCreate because inspections require a position argument.
// This results in a double layer cache.
export function getTriedInspection(
    textDocument: TextDocument,
    position: Position,
    locale: string | undefined,
): TInspectionCacheItem | undefined {
    const cacheKey: string = textDocument.uri;
    const maybePositionCache: undefined | InspectionMap = triedInspectionCache.get(cacheKey);

    let positionCache: WeakMap<Position, TInspectionCacheItem>;
    // document has been inspected before
    if (maybePositionCache !== undefined) {
        positionCache = maybePositionCache;
    } else {
        positionCache = new WeakMap();
        triedInspectionCache.set(textDocument.uri, positionCache);
    }

    if (positionCache.has(position)) {
        return {
            result: positionCache.get(position),
            kind: CacheStageKind.Inspection,
        };
    } else {
        const value: PQP.Task.TriedInspection | undefined = createTriedInspection(textDocument, position, locale);
        positionCache.set(position, value);
        return value;
    }
}

// type TCacheItem = LexerCacheItem | LexerSnapshotCacheItem;

type LexerCacheItem = CacheItem<PQP.Lexer.TriedLex, CacheStageKind.Lexer>;

type TLexerSnapshotCacheItem = LexerSnapshotCacheItem | LexerCacheItem;
type LexerSnapshotCacheItem = CacheItem<PQP.TriedLexerSnapshot, CacheStageKind.LexerSnapshot>;

type TParserCacheItem = ParserCacheItem | TLexerSnapshotCacheItem;
type ParserCacheItem = CacheItem<PQP.TriedParse, CacheStageKind.Parser>;

type TInspectionCacheItem = InspectionCacheItem | TLexerSnapshotCacheItem;
type InspectionCacheItem = CacheItem<TriedInspection, CacheStageKind.Inspection>;

interface CacheItem<T, Stage extends CacheStageKind> {
    readonly result: T;
    readonly stage: Stage;
}

const enum CacheStageKind {
    Lexer,
    LexerSnapshot,
    Parser,
    Inspection,
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
        result: PQP.LexerSnapshot.tryFrom(lexerState),
        stage: CacheStageKind.LexerSnapshot,
    };
}

function createParserCacheItem(textDocument: TextDocument, locale: string | undefined): TParserCacheItem {
    const lexerSnapshotCacheItem: TLexerSnapshotCacheItem = getTriedLexerSnapshot(textDocument, locale);
    if (
        lexerSnapshotCacheItem.stage !== CacheStageKind.LexerSnapshot ||
        PQP.ResultUtils.isErr(lexerSnapshotCacheItem.result)
        // PQP.ResultUtils.isErr(lexerSnapshotCacheItem.result)
    ) {
        return lexerSnapshotCacheItem;
    }
    const lexerSnapshot: PQP.LexerSnapshot = lexerSnapshotCacheItem.result.value;

    const settings: PQP.ParseSettings = {
        ...PQP.DefaultSettings,
        ...getSettings(locale),
    };
    const triedParse: PQP.TriedParse = PQP.Task.tryParse(
        settings,
        PQP.IParserStateUtils.stateFactory(settings, lexerSnapshot),
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
    position: Position,
    locale: string | undefined,
): PQP.Task.TriedInspection | undefined {
    const triedLexParse: PQP.Task.TriedLexParse = getTriedLexParse(textDocument, locale);
    if (
        PQP.ResultUtils.isErr(triedLexParse) &&
        (triedLexParse.error instanceof PQP.CommonError.CommonError ||
            triedLexParse.error instanceof PQP.LexError.LexError)
    ) {
        return undefined;
    }

    const maybeTriedParse: PQP.TriedParse | undefined = PQP.Task.maybeTriedParseFromTriedLexParse(triedLexParse);
    if (maybeTriedParse === undefined) {
        return undefined;
    }

    const triedParse: PQP.TriedParse = maybeTriedParse;
    const pqpPosition: PQP.Inspection.Position = {
        lineNumber: position.line,
        lineCodeUnit: position.character,
    };

    return PQP.Task.tryInspection(PQP.DefaultSettings, triedParse, pqpPosition);
}

function getSettings(locale: string | undefined): PQP.CommonSettings {
    return locale ? { locale } : PQP.DefaultSettings;
}
