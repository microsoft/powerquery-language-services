// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { TextDocument } from "vscode-languageserver-textdocument";

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

export interface WorkspaceCacheSettings {
    readonly textDocument: TextDocument;
    readonly parserId: string;
}
