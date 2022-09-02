// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Inspection } from "..";

// A collection of cached promises for a given TextDocument.uri
//
// If lex or parse is undefined, then those promises hasn't been evaluated yet.
// If parse resolves to undefined, then its dependency (lex) couldn't be completed.
// If inspectionByPosition is undefined for a given Position, then its dependency (parse) couldn't be completed.
export interface CacheCollection {
    lex: Promise<PQP.Task.TriedLexTask> | undefined;
    parse: Promise<PQP.Task.TriedParseTask | undefined> | undefined;
    // Inspections are done on a given position so it requires a map for inspection promises.
    readonly inspectionByPosition: Map<string, Promise<Inspection.Inspected> | undefined>;
    readonly typeCache: Inspection.TypeCache;
    readonly version: number;
}
