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

export function assertIsInspectionTask<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheItem: CacheItem<S>,
): asserts cacheItem is InspectionTask {
    if (!isInspectionTask(cacheItem)) {
        throw new PQP.CommonError.InvariantError(`expected cacheItem to be an InspectionCacheItem`, {
            expectedStage: "Inspection",
            actualStage: cacheItem?.stage,
        });
    }
}

export function getOrCreateTypeCache<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    textDocument: TextDocument,
): Inspection.TypeCache {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection<S> = getOrCreateCacheCollection(cacheKey, cacheVersion);

    return cacheCollection.typeCache;
}

export function getOrCreateLex<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
): LexCacheItem {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection<S> = getOrCreateCacheCollection(cacheKey, cacheVersion);
    const [updatedCacheCollection, lexCacheItem]: [CacheCollection<S>, LexCacheItem] = getOrCreateLexCacheItem(
        cacheCollection,
        textDocument,
        lexSettings,
    );

    CacheCollectionByCacheKey.set(cacheKey, updatedCacheCollection);
    return lexCacheItem;
}

export function getOrCreateParse<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings & PQP.ParseSettings<S>,
): ParseCacheItem<S> {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection<S> = getOrCreateCacheCollection(cacheKey, cacheVersion);
    const [updatedCacheCollection, parseCacheItem]: [CacheCollection<S>, ParseCacheItem<S>] = getOrCreateParseCacheItem(
        cacheCollection,
        textDocument,
        lexSettings,
    );

    CacheCollectionByCacheKey.set(cacheKey, updatedCacheCollection);
    return parseCacheItem;
}

export function getOrCreateInspection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings<S>,
    position: Position,
): InspectionCacheItem<S> {
    const cacheKey: string = createCacheKey(textDocument);
    const cacheVersion: number = textDocument.version;
    const cacheCollection: CacheCollection<S> = getOrCreateCacheCollection(cacheKey, cacheVersion);
    const [updatedCacheCollection, inspectionCacheItem]: [
        CacheCollection<S>,
        InspectionCacheItem<S>,
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

export function isInspectionTask<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheItem: CacheItem<S>,
): cacheItem is InspectionTask {
    return cacheItem?.stage === "Inspection";
}

const CacheCollectionByCacheKey: Map<string, CacheCollection> = new Map();

function getOrCreateCacheCollection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheKey: string,
    cacheVersion: number,
): CacheCollection<S> {
    const maybeCollection: CacheCollection<S> | undefined = CacheCollectionByCacheKey.get(cacheKey) as
        | CacheCollection<S>
        | undefined;

    if (maybeCollection !== undefined && maybeCollection.version === cacheVersion) {
        return maybeCollection;
    } else {
        const cacheCollection: CacheCollection<S> = createEmptyCollection(cacheVersion);
        CacheCollectionByCacheKey.set(cacheKey, cacheCollection);
        return cacheCollection;
    }
}

function getOrCreateLexCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheCollection: CacheCollection<S>,
    textDocument: TextDocument,
    lexSettings: PQP.LexSettings,
): [CacheCollection<S>, LexCacheItem] {
    if (cacheCollection.maybeLex) {
        return [cacheCollection, cacheCollection.maybeLex];
    }

    const lexCacheItem: LexCacheItem = PQP.TaskUtils.tryLex(lexSettings, textDocument.getText());
    const updatedCacheCollection: CacheCollection<S> = {
        ...cacheCollection,
        maybeLex: lexCacheItem,
    };

    return [updatedCacheCollection, lexCacheItem];
}

function getOrCreateParseCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheCollection: CacheCollection<S>,
    textDocument: TextDocument,
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings<S>,
): [CacheCollection<S>, ParseCacheItem<S>] {
    if (cacheCollection.maybeParse) {
        return [cacheCollection, cacheCollection.maybeParse];
    }

    const [updatedCacheCollection, lexCacheItem]: [CacheCollection<S>, LexCacheItem] = getOrCreateLexCacheItem(
        cacheCollection,
        textDocument,
        lexAndParseSettings,
    );
    if (!PQP.TaskUtils.isLexStageOk(lexCacheItem)) {
        return [updateCacheCollectionAttribute(updatedCacheCollection, "maybeParse", lexCacheItem), lexCacheItem];
    }

    const parseCacheItem: PQP.Task.TriedParseTask<S> = PQP.TaskUtils.tryParse(
        lexAndParseSettings,
        lexCacheItem.lexerSnapshot,
    );

    return [updateCacheCollectionAttribute(updatedCacheCollection, "maybeParse", parseCacheItem), parseCacheItem];
}

function getOrCreateInspectionCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheCollection: CacheCollection<S>,
    textDocument: TextDocument,
    inspectionSettings: InspectionSettings<S>,
    position: Position,
): [CacheCollection<S>, InspectionCacheItem<S>] {
    if (cacheCollection.maybeInspectionByPosition) {
        const maybeInspectionByPosition: Map<Position, InspectionCacheItem<S>> =
            cacheCollection.maybeInspectionByPosition;
        const maybeInspection: InspectionCacheItem<S> | undefined = maybeInspectionByPosition.get(position);

        if (maybeInspection) {
            return [cacheCollection, maybeInspection];
        }
    }

    const [parseCacheCollection, parseCacheItem]: [CacheCollection<S>, ParseCacheItem<S>] = getOrCreateParseCacheItem(
        cacheCollection,
        textDocument,
        inspectionSettings,
    );
    let parseState: S;

    if (!PQP.TaskUtils.isParseStage(parseCacheItem) || PQP.TaskUtils.isParseStageCommonError(parseCacheItem)) {
        return [parseCacheCollection, parseCacheItem];
    } else if (PQP.TaskUtils.isParseStageOk(parseCacheItem)) {
        parseState = parseCacheItem.parseState;
    } else if (PQP.TaskUtils.isParseStageParseError(parseCacheItem)) {
        parseState = parseCacheItem.parseState;
    } else {
        throw new PQP.CommonError.InvariantError(`this should never be reached, but 'never' doesn't catch it.`);
    }

    const inspection: Inspection.Inspection = Inspection.inspection<S>(
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
    };

    const updatedByPosition: Map<Position, InspectionCacheItem> = new Map(
        parseCacheCollection.maybeInspectionByPosition ?? [],
    );
    updatedByPosition.set(position, inspectionCacheItem);
    const updatedCacheCollection: CacheCollection<S> = updateCacheCollectionAttribute(
        parseCacheCollection,
        "maybeInspectionByPosition",
        updatedByPosition,
    );

    return [updatedCacheCollection, inspectionCacheItem];
}

function updateCacheCollectionAttribute<
    K extends keyof CacheCollection<S>,
    V = CacheCollection[K],
    S extends PQP.Parser.IParseState = PQP.Parser.IParseState
>(cacheCollection: CacheCollection<S>, key: K, value: V): CacheCollection<S> {
    return {
        ...cacheCollection,
        [key]: value,
    };
}

function createEmptyCollection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    version: number,
): CacheCollection<S> {
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
