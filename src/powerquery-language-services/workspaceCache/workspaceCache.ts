// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";

export const enum CacheStageKind {
    Lexer = "Lexer",
    LexerSnapshot = "LexerSnapshot",
    Parser = "Parser",
    Inspection = "Inspection",
}

export type CacheItem<T, E, Stage> = CacheItemOk<T, Stage> | CacheItemErr<E, Stage>;
export type CacheItemOk<T, Stage> = PQP.Ok<T> & { readonly stage: Stage };
export type CacheItemErr<E, Stage> = PQP.Err<E> & { readonly stage: Stage };

export type TCacheItem = LexerCacheItem | LexerSnapshotCacheItem | ParserCacheItem | InspectionCacheItem;

export type LexerCacheItem = CacheItem<PQP.Lexer.State, PQP.Lexer.LexError.TLexError, CacheStageKind.Lexer>;

export type TLexerSnapshotCacheItem = LexerSnapshotCacheItem | LexerCacheItem;
export type LexerSnapshotCacheItem = CacheItem<
    PQP.Lexer.LexerSnapshot,
    PQP.Lexer.LexError.TLexError,
    CacheStageKind.LexerSnapshot
>;

export type TParserCacheItem = ParserCacheItem | TLexerSnapshotCacheItem;
export type ParserCacheItem = CacheItem<PQP.Parser.ParseOk, PQP.Parser.ParseError.TParseError, CacheStageKind.Parser>;

export type TInspectionCacheItem = InspectionCacheItem | TParserCacheItem;
export type InspectionCacheItem = CacheItem<
    Inspection.Inspection,
    PQP.CommonError.CommonError,
    CacheStageKind.Inspection
>;
