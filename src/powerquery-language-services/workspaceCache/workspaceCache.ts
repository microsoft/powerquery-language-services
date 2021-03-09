// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";

export type InspectionTask = Inspection.Inspection & { stage: "Inspection" };

export type CacheItem = LexCacheItem | ParseCacheItem | InspectionCacheItem;

export type LexCacheItem = PQP.Task.TriedLexTask;

export type ParseCacheItem = LexCacheItem | PQP.Task.TriedParseTask;

export type InspectionCacheItem = ParseCacheItem | InspectionTask | undefined;
