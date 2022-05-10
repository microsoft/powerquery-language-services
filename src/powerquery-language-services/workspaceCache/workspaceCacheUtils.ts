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

export function getTypeCache(textDocument: TextDocument, isWorkspaceCacheEnabled: boolean): Inspection.TypeCache {
    if (!isWorkspaceCacheEnabled) {
        return TypeCacheUtils.createEmptyCache();
    }

    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument, isWorkspaceCacheEnabled);

    return cacheCollection.typeCache;
}

export function getOrCreateCacheCollection(
    textDocument: TextDocument,
    isWorkspaceCacheEnabled: boolean,
): CacheCollection {
    if (!isWorkspaceCacheEnabled) {
        return createEmptyCacheCollection(textDocument.version);
    }

    const cacheKey: string = createCollectionCacheKey(textDocument);
    const maybeCollection: CacheCollection | undefined = CacheCollectionByCacheKey.get(cacheKey);

    if (maybeCollection !== undefined) {
        if (textDocument.version === maybeCollection.version) {
            return maybeCollection;
        } else {
            close(textDocument);
        }
    }

    const cacheCollection: CacheCollection = createEmptyCacheCollection(textDocument.version);
    CacheCollectionByCacheKey.set(cacheKey, cacheCollection);

    return cacheCollection;
}

export function getOrCreateLexPromise(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
    isWorkspaceCacheEnabled: boolean,
): Promise<PQP.Task.TriedLexTask> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument, isWorkspaceCacheEnabled);

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
    isWorkspaceCacheEnabled: boolean,
): Promise<PQP.Task.TriedParseTask | undefined> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(textDocument, isWorkspaceCacheEnabled);

    if (cacheCollection.maybeParse) {
        return cacheCollection.maybeParse;
    }

    const maybeTriedLexPromise: Promise<PQP.Task.TriedLexTask> = getOrCreateLexPromise(
        textDocument,
        lexAndParseSettings,
        isWorkspaceCacheEnabled,
    );

    const maybeTriedLex: PQP.Task.TriedLexTask | undefined = await maybeTriedLexPromise;

    if (PQP.TaskUtils.isError(maybeTriedLex)) {
        cacheCollection.maybeParse = Promise.resolve(undefined);

        return undefined;
    }

    cacheCollection.maybeParse = PQP.TaskUtils.tryParse(lexAndParseSettings, maybeTriedLex.lexerSnapshot);

    return cacheCollection.maybeParse;
}

export async function getOrCreateInspectedPromise(
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings,
    position: Position,
): Promise<Inspection.Inspected | undefined> {
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(
        textDocument,
        inspectionSettings.isWorkspaceCacheEnabled,
    );

    const positionMapKey: string = createInspectionByPositionKey(position);

    if (cacheCollection.inspectionByPosition.has(positionMapKey)) {
        return cacheCollection.inspectionByPosition.get(positionMapKey);
    }

    const maybeTriedParsePromise: Promise<PQP.Task.TriedParseTask | undefined> = getOrCreateParsePromise(
        textDocument,
        inspectionSettings,
        inspectionSettings.isWorkspaceCacheEnabled,
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

    return Inspection.inspect(
        inspectionSettings,
        parseState,
        PQP.TaskUtils.isParseStageParseError(maybeTriedParse) ? maybeTriedParse.error : undefined,
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
        maybeLex: undefined,
        maybeParse: undefined,
        inspectionByPosition: new Map(),
        typeCache: TypeCacheUtils.createEmptyCache(),
        version,
    };
}

function createInspectionByPositionKey(position: Position): string {
    return `${position.character};${position.line}`;
}
