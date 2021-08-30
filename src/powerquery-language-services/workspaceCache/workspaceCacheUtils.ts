// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import type { Position } from "vscode-languageserver-types";

import { Inspection } from "..";
import { TypeCacheUtils } from "../inspection";
import { InspectionSettings } from "../inspectionSettings";
import type {
    CacheCollection,
    CacheItem,
    InspectionCacheItem,
    InspectionTask,
    LexCacheItem,
    ParseCacheItem,
} from "./workspaceCache";

export function assertIsInspectionTask(cacheItem: CacheItem): asserts cacheItem is InspectionTask {
    if (!isInspectionTask(cacheItem)) {
        throw new PQP.CommonError.InvariantError(`expected cacheItem to be an InspectionCacheItem`, {
            expectedStage: "Inspection",
            actualStage: cacheItem?.stage,
        });
    }
}

export function getOrCreateTypeCache(textDocument: TextDocument): Inspection.TypeCache {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(cacheKey, cacheVersion);

    return cacheCollection.typeCache;
}

export function getOrCreateLex(textDocument: TextDocument, lexSettings: PQP.LexSettings): LexCacheItem {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(cacheKey, cacheVersion);
    const [updatedCacheCollection, lexCacheItem]: [CacheCollection, LexCacheItem] = getOrCreateLexCacheItem(
        cacheCollection,
        textDocument,
        lexSettings,
    );

    CacheCollectionByCacheKey.set(cacheKey, updatedCacheCollection);
    return lexCacheItem;
}

export function getOrCreateParse(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings & PQP.ParseSettings,
): ParseCacheItem {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(cacheKey, cacheVersion);
    const [updatedCacheCollection, parseCacheItem]: [CacheCollection, ParseCacheItem] = getOrCreateParseCacheItem(
        cacheCollection,
        textDocument,
        lexSettings,
    );

    CacheCollectionByCacheKey.set(cacheKey, updatedCacheCollection);
    return parseCacheItem;
}

export function getOrCreateInspection(
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings,
    position: Position,
): InspectionCacheItem {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection = getOrCreateCacheCollection(cacheKey, cacheVersion);
    const [updatedCacheCollection, inspectionCacheItem]: [
        CacheCollection,
        InspectionCacheItem,
    ] = getOrCreateInspectionCacheItem(cacheCollection, textDocument, inspectionSettings, position);

    CacheCollectionByCacheKey.set(cacheKey, updatedCacheCollection);
    return inspectionCacheItem;
}

// TODO: is the position key valid for a single intellisense operation,
// or would it be the same for multiple invocations?
export function close(textDocument: TextDocument): void {
    const cacheKey: string = createCacheKey(textDocument);
    CacheCollectionByCacheKey.delete(cacheKey);
}

export function update(
    textDocument: TextDocument,
    _changes: ReadonlyArray<TextDocumentContentChangeEvent>,
    _version: number,
): void {
    // TODO: support incremental lexing
    // TODO: premptively prepare cache on background thread?
    // TODO: use document version
    close(textDocument);
}

export function isInspectionTask(cacheItem: CacheItem): cacheItem is InspectionTask {
    return cacheItem?.stage === "Inspection";
}

const CacheCollectionByCacheKey: Map<string, CacheCollection> = new Map();

function getOrCreateCacheCollection(cacheKey: string, cacheVersion: number): CacheCollection {
    const maybeCollection: CacheCollection | undefined = CacheCollectionByCacheKey.get(cacheKey) as
        | CacheCollection
        | undefined;

    if (maybeCollection !== undefined && maybeCollection.version === cacheVersion) {
        return maybeCollection;
    } else {
        const cacheCollection: CacheCollection = createEmptyCollection(cacheVersion);
        CacheCollectionByCacheKey.set(cacheKey, cacheCollection);
        return cacheCollection;
    }
}

function getOrCreateLexCacheItem(
    cacheCollection: CacheCollection,
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
): [CacheCollection, LexCacheItem] {
    if (cacheCollection.maybeLex) {
        return [cacheCollection, cacheCollection.maybeLex];
    }

    const lexCacheItem: LexCacheItem = PQP.TaskUtils.tryLex(lexSettings, textDocument.getText());
    const updatedCacheCollection: CacheCollection = {
        ...cacheCollection,
        maybeLex: lexCacheItem,
    };

    return [updatedCacheCollection, lexCacheItem];
}

function getOrCreateParseCacheItem(
    cacheCollection: CacheCollection,
    textDocument: TextDocument,
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings,
): [CacheCollection, ParseCacheItem] {
    if (cacheCollection.maybeParse) {
        return [cacheCollection, cacheCollection.maybeParse];
    }

    const [updatedCacheCollection, lexCacheItem]: [CacheCollection, LexCacheItem] = getOrCreateLexCacheItem(
        cacheCollection,
        textDocument,
        lexAndParseSettings,
    );
    if (!PQP.TaskUtils.isLexStageOk(lexCacheItem)) {
        return [updateCacheCollectionAttribute(updatedCacheCollection, "maybeParse", lexCacheItem), lexCacheItem];
    }

    const parseCacheItem: PQP.Task.TriedParseTask = PQP.TaskUtils.tryParse(
        lexAndParseSettings,
        lexCacheItem.lexerSnapshot,
    );

    return [updateCacheCollectionAttribute(updatedCacheCollection, "maybeParse", parseCacheItem), parseCacheItem];
}

function getOrCreateInspectionCacheItem(
    cacheCollection: CacheCollection,
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings,
    position: Position,
): [CacheCollection, InspectionCacheItem] {
    if (cacheCollection.maybeInspectionByPosition) {
        const maybeInspectionByPosition: Map<Position, InspectionCacheItem> = cacheCollection.maybeInspectionByPosition;
        const maybeInspection: InspectionCacheItem | undefined = maybeInspectionByPosition.get(position);

        if (maybeInspection) {
            return [cacheCollection, maybeInspection];
        }
    }

    const [parseCacheCollection, parseCacheItem]: [CacheCollection, ParseCacheItem] = getOrCreateParseCacheItem(
        cacheCollection,
        textDocument,
        inspectionSettings,
    );
    let parseState: PQP.Parser.ParseState;

    if (!PQP.TaskUtils.isParseStage(parseCacheItem) || PQP.TaskUtils.isParseStageCommonError(parseCacheItem)) {
        return [parseCacheCollection, parseCacheItem];
    } else if (PQP.TaskUtils.isParseStageOk(parseCacheItem)) {
        parseState = parseCacheItem.parseState;
    } else if (PQP.TaskUtils.isParseStageParseError(parseCacheItem)) {
        parseState = parseCacheItem.parseState;
    } else {
        throw new PQP.CommonError.InvariantError(`this should never be reached, but 'never' doesn't catch it.`);
    }

    const inspection: Inspection.Inspection = Inspection.inspection(
        inspectionSettings,
        parseState,
        PQP.TaskUtils.isParseStageParseError(parseCacheItem) ? parseCacheItem.error : undefined,
        position,
        cacheCollection.typeCache,
    );
    const inspectionCacheItem: InspectionCacheItem = {
        ...inspection,
        stage: "Inspection",
        version: textDocument.version,
        parseState,
    };

    const updatedByPosition: Map<Position, InspectionCacheItem> = new Map(
        parseCacheCollection.maybeInspectionByPosition ?? [],
    );
    updatedByPosition.set(position, inspectionCacheItem);
    const updatedCacheCollection: CacheCollection = updateCacheCollectionAttribute(
        parseCacheCollection,
        "maybeInspectionByPosition",
        updatedByPosition,
    );

    return [updatedCacheCollection, inspectionCacheItem];
}

function updateCacheCollectionAttribute<K extends keyof CacheCollection, V = CacheCollection[K]>(
    cacheCollection: CacheCollection,
    key: K,
    value: V,
): CacheCollection {
    return {
        ...cacheCollection,
        [key]: value,
    };
}

function createEmptyCollection(version: number): CacheCollection {
    return {
        version,
        maybeLex: undefined,
        maybeParse: undefined,
        maybeInspectionByPosition: undefined,
        typeCache: TypeCacheUtils.createEmptyCache(),
    };
}

function createCacheKey(textDocument: TextDocument): string {
    return textDocument.uri;
}
