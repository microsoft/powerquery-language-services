// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Inspection } from "..";

export interface InspectionTask {
    readonly stage: "Inspection";
    readonly result: Inspection.Inspection;
}

// A collection of cached promises for a given TextDocument.uri
//
// If maybeLex or maybeParse is undefined, then those promises hasn't been evaluated yet.
// If maybeParse resolves to undefined, then its dependency (lex) couldn't be completed.
// If inspectionByPosition is undefined for a given Position, then its dependency (parse) couldn't be completed.
export interface CacheCollection {
    maybeLex: Promise<PQP.Task.TriedLexTask> | undefined;
    maybeParse: Promise<PQP.Task.TriedParseTask | undefined> | undefined;
    // Inspections are done on a given position so it requires a map for inspection promises.
    inspectionByPosition: Map<string, Promise<Inspection.Inspection> | undefined>;
    typeCache: Inspection.TypeCache;
}
