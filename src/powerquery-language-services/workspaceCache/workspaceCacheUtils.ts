// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { CacheCollection } from "./workspaceCache";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { TypeCacheUtils } from "../inspection";

const CacheCollectionByCacheKey: Map<string, CacheCollection> = new Map();

export function getTypeCache(textDocument: TextDocument): Inspection.TypeCache {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument);

    return cacheCollection.typeCache;
}

export function getOrCreateLexPromise(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
): Promise<PQP.Task.TriedLexTask> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument);

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
): Promise<PQP.Task.TriedParseTask | undefined> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument);

    if (cacheCollection.maybeParse) {
        return cacheCollection.maybeParse;
    }

    const maybeTriedLexPromise: Promise<PQP.Task.TriedLexTask> = getOrCreateLexPromise(
        textDocument,
        lexAndParseSettings,
    );

    const maybeTriedLex: PQP.Task.TriedLexTask | undefined = await maybeTriedLexPromise;

    if (PQP.TaskUtils.isError(maybeTriedLex)) {
        cacheCollection.maybeParse = Promise.resolve(undefined);

        return undefined;
    }

    cacheCollection.maybeParse = PQP.TaskUtils.tryParse(lexAndParseSettings, maybeTriedLex.lexerSnapshot);

    return cacheCollection.maybeParse;
}

export async function getOrCreateInspectionPromise(
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings,
    position: Position,
): Promise<Inspection.Inspection | undefined> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument);
    const positionMapKey: string = createInspectionByPositionKey(position);

    if (cacheCollection.inspectionByPosition.has(positionMapKey)) {
        return cacheCollection.inspectionByPosition.get(positionMapKey);
    }

    const maybeTriedParsePromise: Promise<PQP.Task.TriedParseTask | undefined> = getOrCreateParsePromise(
        textDocument,
        inspectionSettings,
    );

    const maybeTriedParse: PQP.Task.TriedParseTask | undefined = await maybeTriedParsePromise;

    if (
        maybeTriedParse === undefined ||
        !PQP.TaskUtils.isParseStage(maybeTriedParse) ||
        PQP.TaskUtils.isParseStageCommonError(maybeTriedParse)
    ) {
        cacheCollection.inspectionByPosition.set(positionMapKey, undefined);

        return undefined;
    }

    let parseState: PQP.Parser.ParseState;

    if (PQP.TaskUtils.isParseStageOk(maybeTriedParse)) {
        parseState = maybeTriedParse.parseState;
    } else if (PQP.TaskUtils.isParseStageParseError(maybeTriedParse)) {
        parseState = maybeTriedParse.parseState;
    } else {
        throw PQP.Assert.isNever(maybeTriedParse);
    }

    return Inspection.inspection(
        inspectionSettings,
        parseState,
        PQP.TaskUtils.isParseStageParseError(maybeTriedParse) ? maybeTriedParse.error : undefined,
        position,
        cacheCollection.typeCache,
    );
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

function getOrCreateCacheCollection(textDocument: TextDocument): CacheCollection {
    const cacheKey: string = createCacheKey(textDocument);
    const maybeCollection: CacheCollection | undefined = CacheCollectionByCacheKey.get(cacheKey);

    if (maybeCollection !== undefined) {
        return maybeCollection;
    } else {
        const cacheCollection: CacheCollection = createEmptyCollection();
        CacheCollectionByCacheKey.set(cacheKey, cacheCollection);

        return cacheCollection;
    }
}
