// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Inspection } from "..";

export type PromiseParse = Promise<PQP.Task.TriedLexTask | PQP.Task.TriedParseTask>;

// A collection of cached promises for a given TextDocument.uri
export interface CacheCollection {
    maybeLex: Promise<PQP.Task.TriedLexTask> | undefined;
    maybeParse: PromiseParse | undefined;
    // Inspections are done on a given position so it requires a map for inspection promises.
    inspectionByPosition: Map<string, Promise<Inspection.Inspection> | undefined>;
    typeCache: Inspection.TypeCache;
}
