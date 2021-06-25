// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position } from "vscode-languageserver-textdocument";

import { Inspection } from "..";

export type InspectionTask = Inspection.Inspection & {
    readonly stage: "Inspection";
    readonly version: number;
    readonly parseState: PQP.Parser.ParseState;
};

export type CacheItem = LexCacheItem | ParseCacheItem | InspectionCacheItem;

export type LexCacheItem = PQP.Task.TriedLexTask;

export type ParseCacheItem = LexCacheItem | PQP.Task.TriedParseTask;

export type InspectionCacheItem = ParseCacheItem | InspectionTask | undefined;

// A collection for a given TextDocument.uri
export interface CacheCollection {
    readonly maybeLex: LexCacheItem | undefined;
    readonly maybeParse: ParseCacheItem | undefined;
    readonly maybeInspectionByPosition: Map<Position, InspectionCacheItem> | undefined;
    readonly typeCache: Inspection.TypeCache;
    readonly version: number;
}
