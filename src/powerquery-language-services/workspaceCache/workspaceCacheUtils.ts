// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { CacheCollection } from "./workspaceCache";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { TypeCacheUtils } from "../inspection";

// export function assertIsInspectionTask(cacheItem: CacheItem): asserts cacheItem is InspectionTask {
//     if (!isInspectionTask(cacheItem)) {
//         throw new PQP.CommonError.InvariantError(`expected cacheItem to be an InspectionCacheItem`, {
//             expectedStage: "Inspection",
//             actualStage: cacheItem?.stage,
//         });
//     }
// }

const CacheCollectionByCacheKey: Map<string, CacheCollection> = new Map();

export function getTypeCache(textDocument: TextDocument): Inspection.TypeCache {
    const cacheCollection: CacheCollection = getCacheCollection(textDocument);

    return cacheCollection.typeCache;
}

export function getOrCreateLexPromise(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
): Promise<PQP.Task.TriedLexTask> {
    const cacheCollection: CacheCollection = getCacheCollection(textDocument);

    if (cacheCollection.maybeLex) {
        return cacheCollection.maybeLex;
    }

    const lexPromise: Promise<PQP.Task.TriedLexTask> = Promise.resolve(
        PQP.TaskUtils.tryLex(lexSettings, textDocument.getText()),
    );

    cacheCollection.maybeLex = lexPromise;

    return lexPromise;
}

export async function getOrCreateParsePromise(
    textDocument: TextDocument,
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings,
): Promise<PQP.Task.TriedLexTask | PQP.Task.TriedParseTask> {
    const cacheCollection: CacheCollection = getCacheCollection(textDocument);

    if (cacheCollection.maybeParse) {
        return cacheCollection.maybeParse;
    }

    const triedLexPromise: Promise<PQP.Task.TriedLexTask> = getOrCreateLexPromise(textDocument, lexAndParseSettings);
    const triedLex: PQP.Task.TriedLexTask = await triedLexPromise;

    if (PQP.TaskUtils.isError(triedLex)) {
        cacheCollection.maybeParse = triedLexPromise;

        return triedLexPromise;
    }

    cacheCollection.maybeParse = PQP.TaskUtils.tryParse(lexAndParseSettings, triedLex.lexerSnapshot);

    return cacheCollection.maybeParse;
}

export async function getOrCreateInspectionPromise(
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings,
    position: Position,
): Promise<PQP.Task.TriedLexTask | PQP.Task.TriedParseTask | Inspection.Inspection> {
    const cacheCollection: CacheCollection = getCacheCollection(textDocument);
    const positionMapKey: string = createInspectionByPositionKey(position);

    const maybeInspectionPromise: Promise<Inspection.Inspection> | undefined =
        cacheCollection.inspectionByPosition.get(positionMapKey);

    if (maybeInspectionPromise) {
        return maybeInspectionPromise;
    }

    const triedParsePromise: Promise<PQP.Task.TriedLexTask | PQP.Task.TriedParseTask> = getOrCreateParsePromise(
        textDocument,
        inspectionSettings,
    );

    const triedParse: PQP.Task.TriedLexTask | PQP.Task.TriedParseTask = await triedParsePromise;

    if (!PQP.TaskUtils.isParseStage(triedParse) || PQP.TaskUtils.isParseStageCommonError(triedParse)) {
        cacheCollection.inspectionByPosition.set(positionMapKey, undefined);

        return triedParsePromise;
    }

    let parseState: PQP.Parser.ParseState;

    if (PQP.TaskUtils.isParseStageOk(triedParse)) {
        parseState = triedParse.parseState;
    } else if (PQP.TaskUtils.isParseStageParseError(triedParse)) {
        parseState = triedParse.parseState;
    } else {
        throw PQP.Assert.isNever(triedParse);
    }

    const inspectionPromise: Promise<Inspection.Inspection> = Inspection.inspection(
        inspectionSettings,
        parseState,
        PQP.TaskUtils.isParseStageParseError(triedParse) ? triedParse.error : undefined,
        position,
        cacheCollection.typeCache,
    );

    cacheCollection.inspectionByPosition.set(positionMapKey, inspectionPromise);

    return inspectionPromise;
}

function createCacheKey(textDocument: TextDocument): string {
    return `${textDocument.uri}`;
}

function createEmptyCollection(): CacheCollection {
    return {
        maybeLex: undefined,
        maybeParse: undefined,
        inspectionByPosition: new Map(),
        typeCache: TypeCacheUtils.createEmptyCache(),
    };
}

function createInspectionByPositionKey(position: Position): string {
    return `${position.character};${position.line}`;
}

function getCacheCollection(textDocument: TextDocument): CacheCollection {
    const cacheKey: string = createCacheKey(textDocument);

    const maybeCollection: CacheCollection | undefined = CacheCollectionByCacheKey.get(cacheKey) as
        | CacheCollection
        | undefined;

    if (maybeCollection !== undefined) {
        return maybeCollection;
    } else {
        const cacheCollection: CacheCollection = createEmptyCollection();
        CacheCollectionByCacheKey.set(cacheKey, cacheCollection);

        return cacheCollection;
    }
}
