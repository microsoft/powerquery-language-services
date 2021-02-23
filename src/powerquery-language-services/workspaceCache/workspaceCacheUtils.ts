// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { Position, TextDocument, TextDocumentContentChangeEvent } from "../commonTypes";
import type {
    InspectionCacheItem,
    LexerCacheItem,
    LexerSnapshotCacheItem,
    ParserCacheItem,
    TInspectionCacheItem,
    TLexerSnapshotCacheItem,
    TParserCacheItem,
} from "./workspaceCache";
import { CacheStageKind } from "./workspaceCache";

// TODO: is the position key valid for a single intellisense operation,
// or would it be the same for multiple invocations?
export function close(textDocument: TextDocument): void {
    AllCaches.forEach(map => {
        map.delete(textDocument.uri);
    });
}

export function isLexerCacheItem(maybeValue: LexerCacheItem | undefined): maybeValue is LexerCacheItem {
    return maybeValue?.stage === CacheStageKind.Lexer;
}

export function isLexerSnapshotCacheItem(
    maybeValue: TLexerSnapshotCacheItem | undefined,
): maybeValue is LexerSnapshotCacheItem {
    return maybeValue?.stage === CacheStageKind.LexerSnapshot;
}

export function isParserCacheItem(maybeValue: TParserCacheItem | undefined): maybeValue is ParserCacheItem {
    return maybeValue?.stage === CacheStageKind.Parser;
}

export function isInspectionItem(maybeValue: TInspectionCacheItem | undefined): maybeValue is InspectionCacheItem {
    return maybeValue?.stage === CacheStageKind.Inspection;
}

export function getLexerState(textDocument: TextDocument, maybeLocale: string | undefined): LexerCacheItem {
    return getOrCreate(LexerStateCache, textDocument, maybeLocale, createLexerCacheItem);
}

export function getTriedLexerSnapshot(
    textDocument: TextDocument,
    maybeLocale: string | undefined,
): TLexerSnapshotCacheItem {
    return getOrCreate(LexerSnapshotCache, textDocument, maybeLocale, createLexerSnapshotCacheItem);
}

export function getTriedParse(textDocument: TextDocument, maybeLocale: string | undefined): TParserCacheItem {
    return getOrCreate(ParserCache, textDocument, maybeLocale, createParserCacheItem);
}

// We can't easily reuse getOrCreate because inspections require a position argument.
// This results in a double layer cache.
export function getTriedInspection(
    textDocument: TextDocument,
    position: Position,
    externalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn,
    maybeLocale: string | undefined,
): TInspectionCacheItem | undefined {
    const cacheKey: string = textDocument.uri;
    const maybePositionCache: undefined | InspectionMap = InspectionCache.get(cacheKey);

    let positionCache: WeakMap<Position, TInspectionCacheItem>;
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
        const value: TInspectionCacheItem | undefined = createTriedInspection(
            textDocument,
            position,
            externalTypeResolver,
            maybeLocale,
        );
        positionCache.set(position, value);
        return value;
    }
}

export function update(
    textDocument: TextDocument,
    _changes: ReadonlyArray<TextDocumentContentChangeEvent>,
    _version: number,
): void {
    // TODO: support incremental lexing
    // TODO: premptively prepare cache on background thread?
    // TODO: use document version
    close(textDocument);
}

// Notice that the value type for WeakMap includes undefined.
// Take the scenario where an inspection was requested on a document that was not parsable,
// then createTriedInspection would return undefined as you can't inspect something that wasn't parsed.
// If we used WeakMap.get(...) we wouldn't know if an undefined was returned because of a cache miss
// or that we we couldn't do an inspection.
type InspectionMap = WeakMap<Position, TInspectionCacheItem>;

const LexerStateCache: Map<string, LexerCacheItem> = new Map();
const LexerSnapshotCache: Map<string, TLexerSnapshotCacheItem> = new Map();
const ParserCache: Map<string, TParserCacheItem> = new Map();
const InspectionCache: Map<string, InspectionMap> = new Map();

const AllCaches: Map<string, any>[] = [LexerSnapshotCache, LexerStateCache, ParserCache, InspectionCache];

export type CacheItem<T, E, Stage> = CacheItemOk<T, Stage> | CacheItemErr<E, Stage>;
export type CacheItemOk<T, Stage> = PQP.Ok<T> & { readonly stage: Stage };
export type CacheItemErr<E, Stage> = PQP.Err<E> & { readonly stage: Stage };

function getOrCreate<T>(
    cache: Map<string, T>,
    textDocument: TextDocument,
    maybeLocale: string | undefined,
    factoryFn: (textDocument: TextDocument, maybeLocale: string | undefined) => T,
): T {
    const cacheKey: string = textDocument.uri;
    const maybeValue: T | undefined = cache.get(cacheKey);

    if (maybeValue === undefined) {
        const value: T = factoryFn(textDocument, maybeLocale);
        cache.set(cacheKey, value);
        return value;
    } else {
        return maybeValue;
    }
}

function createLexerCacheItem(textDocument: TextDocument, maybeLocale: string | undefined): LexerCacheItem {
    return {
        ...PQP.Lexer.tryLex(getSettings(undefined, maybeLocale), textDocument.getText()),
        stage: CacheStageKind.Lexer,
    };
}

function createLexerSnapshotCacheItem(
    textDocument: TextDocument,
    maybeLocale: string | undefined,
): TLexerSnapshotCacheItem {
    const lexerCacheItem: LexerCacheItem = getLexerState(textDocument, maybeLocale);
    if (PQP.ResultUtils.isErr(lexerCacheItem)) {
        return lexerCacheItem;
    }
    const lexerState: PQP.Lexer.State = lexerCacheItem.value;

    return {
        ...PQP.Lexer.trySnapshot(lexerState),
        stage: CacheStageKind.LexerSnapshot,
    };
}

function createParserCacheItem(textDocument: TextDocument, maybeLocale: string | undefined): TParserCacheItem {
    const lexerSnapshotCacheItem: TLexerSnapshotCacheItem = getTriedLexerSnapshot(textDocument, maybeLocale);
    if (
        lexerSnapshotCacheItem.stage !== CacheStageKind.LexerSnapshot ||
        PQP.ResultUtils.isErr(lexerSnapshotCacheItem)
    ) {
        return lexerSnapshotCacheItem;
    }
    const lexerSnapshot: PQP.Lexer.LexerSnapshot = lexerSnapshotCacheItem.value;

    const triedParse: PQP.Task.TriedParseTask = PQP.TaskUtils.tryParse(
        getSettings(undefined, maybeLocale),
        lexerSnapshot,
    );

    return {
        ...triedParse,
        stage: CacheStageKind.Parser,
    };
}

// We're allowed to return undefined because if a document wasn't parsed
// then there's no way to perform an inspection.
function createTriedInspection(
    textDocument: TextDocument,
    position: Position,
    externalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn,
    maybeLocale: string | undefined,
): TInspectionCacheItem {
    const parserCacheItem: TParserCacheItem = getTriedParse(textDocument, maybeLocale);
    if (parserCacheItem.stage !== CacheStageKind.Parser) {
        return parserCacheItem;
    }

    return {
        ...PQP.Task.tryInspection(getSettings(externalTypeResolver, maybeLocale), parserCacheItem, {
            lineCodeUnit: position.character,
            lineNumber: position.line,
        }),
        stage: CacheStageKind.Inspection,
    };
}

function getSettings(
    maybeExternalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn | undefined,
    maybeLocale: string | undefined,
): PQP.Settings {
    return {
        ...PQP.DefaultSettings,
        locale: maybeLocale ?? PQP.DefaultSettings.locale,
        maybeExternalTypeResolver,
    };
}
