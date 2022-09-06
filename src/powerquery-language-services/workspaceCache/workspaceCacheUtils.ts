// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import type { Position } from "vscode-languageserver-types";

import { CacheCollection } from "./workspaceCache";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { TypeCacheUtils } from "../inspection";

const CacheCollectionByCacheKey: Map<string, CacheCollection> = new Map();

export function close(textDocument: TextDocument): void {
    const collectionCacheKey: string = createCollectionCacheKey(textDocument);
    CacheCollectionByCacheKey.delete(collectionCacheKey);
}

export function getTypeCache(textDocument: TextDocument, isWorkspaceCacheAllowed: boolean): Inspection.TypeCache {
    if (!isWorkspaceCacheAllowed) {
        return TypeCacheUtils.createEmptyCache();
    }

    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument, isWorkspaceCacheAllowed);

    return cacheCollection.typeCache;
}

export function getOrCreateCacheCollection(
    textDocument: TextDocument,
    isWorkspaceCacheAllowed: boolean,
): CacheCollection {
    if (!isWorkspaceCacheAllowed) {
        return createEmptyCacheCollection(textDocument.version);
    }

    const cacheKey: string = createCollectionCacheKey(textDocument);
    const cacheCollection: CacheCollection | undefined = CacheCollectionByCacheKey.get(cacheKey);

    if (cacheCollection !== undefined) {
        if (textDocument.version === cacheCollection.version) {
            return cacheCollection;
        } else {
            close(textDocument);
        }
    }

    const newCacheCollection: CacheCollection = createEmptyCacheCollection(textDocument.version);

    if (isWorkspaceCacheAllowed) {
        CacheCollectionByCacheKey.set(cacheKey, newCacheCollection);
    }

    return newCacheCollection;
}

export function getOrCreateLexPromise(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
    isWorkspaceCacheAllowed: boolean,
): Promise<PQP.Task.TriedLexTask> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument, isWorkspaceCacheAllowed);

    if (cacheCollection.lex) {
        return cacheCollection.lex;
    }

    const lexPromise: Promise<PQP.Task.TriedLexTask> = Promise.resolve(
        PQP.TaskUtils.tryLex(lexSettings, textDocument.getText()),
    );

    cacheCollection.lex = lexPromise;

    return lexPromise;
}

export async function getOrCreateParsePromise(
    textDocument: TextDocument,
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings,
    isWorkspaceCacheAllowed: boolean,
): Promise<PQP.Task.TriedParseTask | undefined> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument, isWorkspaceCacheAllowed);

    if (cacheCollection.parse) {
        return cacheCollection.parse;
    }

    const triedLexPromise: Promise<PQP.Task.TriedLexTask> = getOrCreateLexPromise(
        textDocument,
        lexAndParseSettings,
        isWorkspaceCacheAllowed,
    );

    const triedLex: PQP.Task.TriedLexTask | undefined = await triedLexPromise;

    if (PQP.TaskUtils.isError(triedLex)) {
        cacheCollection.parse = Promise.resolve(undefined);

        return undefined;
    }

    cacheCollection.parse = PQP.TaskUtils.tryParse(lexAndParseSettings, triedLex.lexerSnapshot);

    return cacheCollection.parse;
}

export async function getOrCreateInspectedPromise(
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings,
    position: Position,
): Promise<Inspection.Inspected | undefined> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(
        textDocument,
        inspectionSettings.isWorkspaceCacheAllowed,
    );

    const positionMapKey: string = createInspectionByPositionKey(position);

    if (cacheCollection.inspectionByPosition.has(positionMapKey)) {
        return cacheCollection.inspectionByPosition.get(positionMapKey);
    }

    const triedParsePromise: Promise<PQP.Task.TriedParseTask | undefined> = getOrCreateParsePromise(
        textDocument,
        inspectionSettings,
        inspectionSettings.isWorkspaceCacheAllowed,
    );

    const triedParseTask: PQP.Task.TriedParseTask | undefined = await triedParsePromise;

    if (
        triedParseTask === undefined ||
        !PQP.TaskUtils.isParseStage(triedParseTask) ||
        PQP.TaskUtils.isParseStageCommonError(triedParseTask)
    ) {
        if (inspectionSettings.isWorkspaceCacheAllowed) {
            cacheCollection.inspectionByPosition.set(positionMapKey, undefined);
        }

        return undefined;
    }

    let parseState: PQP.Parser.ParseState;

    if (PQP.TaskUtils.isParseStageOk(triedParseTask)) {
        parseState = triedParseTask.parseState;
    } else if (PQP.TaskUtils.isParseStageParseError(triedParseTask)) {
        parseState = triedParseTask.parseState;
    } else {
        throw PQP.Assert.isNever(triedParseTask);
    }

    return Inspection.inspect(
        inspectionSettings,
        parseState,
        PQP.TaskUtils.isParseStageParseError(triedParseTask) ? triedParseTask.error : undefined,
        position,
        cacheCollection.typeCache,
    );
}

export function update(
    textDocument: TextDocument,
    _changes: ReadonlyArray<TextDocumentContentChangeEvent>,
    _version: number,
): void {
    close(textDocument);
}

function createCollectionCacheKey(textDocument: TextDocument): string {
    return `${textDocument.uri}`;
}

function createEmptyCacheCollection(version: number): CacheCollection {
    return {
        lex: undefined,
        parse: undefined,
        inspectionByPosition: new Map(),
        typeCache: TypeCacheUtils.createEmptyCache(),
        version,
    };
}

function createInspectionByPositionKey(position: Position): string {
    return `${position.character};${position.line}`;
}
