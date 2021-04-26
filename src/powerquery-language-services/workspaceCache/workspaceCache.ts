// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position } from "vscode-languageserver-textdocument";

import { Inspection } from "..";

export type InspectionTask = Inspection.Inspection & { stage: "Inspection" };

export type CacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> =
    | LexCacheItem
    | ParseCacheItem<S>
    | InspectionCacheItem;

export type LexCacheItem = PQP.Task.TriedLexTask;

export type ParseCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> =
    | LexCacheItem
    | PQP.Task.TriedParseTask<S>;

export type InspectionCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> =
    | ParseCacheItem<S>
    | InspectionTask
    | undefined;

export interface CacheCollection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> {
    readonly maybeLex: LexCacheItem | undefined;
    readonly maybeParse: ParseCacheItem<S> | undefined;
    readonly maybeInspection: Map<Position, InspectionCacheItem<S>> | undefined;
    readonly typeCache: Inspection.TypeCache;
}
