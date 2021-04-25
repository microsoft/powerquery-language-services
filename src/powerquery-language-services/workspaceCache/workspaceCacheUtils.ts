// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver-types";

import { Inspection } from "..";
import type {
    CacheCollection,
    CacheItem,
    InspectionCacheItem,
    InspectionTask,
    LexCacheItem,
    ParseCacheItem,
    WorkspaceCacheSettings,
} from "./workspaceCache";

const CacheByParserId: Map<string, CacheCollection> = new Map();

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

export function close(workspaceCacheSettings: WorkspaceCacheSettings): void {
    const cacheCollection: CacheCollection = getOrCreateCacheByParserId(workspaceCacheSettings.parserId);
    const cacheKey: string = createCacheKey(workspaceCacheSettings);

    cacheCollection.lex.delete(cacheKey);
    cacheCollection.parse.delete(cacheKey);
    cacheCollection.inspection.delete(cacheKey);
}

export function update(
    workspaceCacheSettings: WorkspaceCacheSettings,
    _changes: ReadonlyArray<TextDocumentContentChangeEvent>,
    _version: number,
): void {
    // TODO: support incremental lexing
    // TODO: premptively prepare cache on background thread?
    // TODO: use document version
    close(workspaceCacheSettings);
}

export function getOrCreateLex(
    workspaceCacheSettings: WorkspaceCacheSettings,
    lexSettings: PQP.LexSettings,
): LexCacheItem {
    const cacheCollection: CacheCollection = getOrCreateCacheByParserId(workspaceCacheSettings.parserId);

    return getOrCreateDefault(cacheCollection.lex, createCacheKey(workspaceCacheSettings), () =>
        createLexCacheItem(workspaceCacheSettings, lexSettings),
    );
}

export function getOrCreateParse<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    workspaceCacheSettings: WorkspaceCacheSettings,
    lexAndParseSettings: PQP.LexSettings & PQP.ParseSettings<S>,
): ParseCacheItem<S> {
    const cacheCollection: CacheCollection = getOrCreateCacheByParserId(workspaceCacheSettings.parserId);

    return getOrCreateDefault(cacheCollection.lex, createCacheKey(workspaceCacheSettings), () =>
        createParseCacheItem(workspaceCacheSettings, lexAndParseSettings),
    );
}

// This code is a bit more complex as there's two layers of cache indirection,
// first by the usual parserId, then by position (as some inspections are position sensitive).
export function getOrCreateInspection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    workspaceCacheSettings: WorkspaceCacheSettings,
    inspectionSettings: Inspection.InspectionSettings<S>,
    position: Position,
): InspectionCacheItem<S> {
    const cacheCollection: CacheCollection<S> = getOrCreateCacheByParserId(workspaceCacheSettings.parserId);
    const cacheKey: string = createCacheKey(workspaceCacheSettings);
    const maybeByCacheKey: Map<Position, InspectionCacheItem<S>> | undefined = cacheCollection.inspection.get(cacheKey);

    let byCacheKey: Map<Position, InspectionCacheItem<S>>;
    if (maybeByCacheKey === undefined) {
        byCacheKey = new Map();
        cacheCollection.inspection.set(cacheKey, byCacheKey);
    } else {
        byCacheKey = maybeByCacheKey;
    }

    return getOrCreateDefault(byCacheKey, position, () =>
        createInspectionCacheItem(workspaceCacheSettings, inspectionSettings, position),
    );
}

export function isInspectionTask<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    cacheItem: CacheItem<S>,
): cacheItem is InspectionTask {
    return cacheItem?.stage === "Inspection";
}

function createCacheCollection<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(): CacheCollection<S> {
    return {
        lex: new Map(),
        parse: new Map(),
        inspection: new Map(),
    };
}

function createCacheKey(workspaceCacheSettings: WorkspaceCacheSettings): string {
    return workspaceCacheSettings.textDocument.uri;
}

function createLexCacheItem(
    workspaceCacheSettings: WorkspaceCacheSettings,
    lexSettings: PQP.LexSettings,
): LexCacheItem {
    return PQP.TaskUtils.tryLex(lexSettings, workspaceCacheSettings.textDocument.getText());
}

function createParseCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    workspaceCacheSettings: WorkspaceCacheSettings,
    lexParseSettings: PQP.LexSettings & PQP.ParseSettings<S>,
): ParseCacheItem<S> {
    const triedLexTask: PQP.Task.TriedLexTask = getOrCreateLex(workspaceCacheSettings, lexParseSettings);
    if (!PQP.TaskUtils.isLexStageOk(triedLexTask)) {
        return triedLexTask;
    }

    return PQP.TaskUtils.tryParse(lexParseSettings, triedLexTask.lexerSnapshot);
}

function createInspectionCacheItem<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    workspaceCacheSettings: WorkspaceCacheSettings,
    inspectionSettings: Inspection.InspectionSettings<S>,
    position: Position,
): InspectionCacheItem<S> | undefined {
    const parseCacheItem: ParseCacheItem<S> = getOrCreateParse(workspaceCacheSettings, inspectionSettings);
    let parseState: S;

    if (!PQP.TaskUtils.isParseStage(parseCacheItem) || PQP.TaskUtils.isParseStageCommonError(parseCacheItem)) {
        return parseCacheItem;
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
        {
            lineNumber: position.line,
            lineCodeUnit: position.character,
        },
    );

    return {
        ...inspection,
        stage: "Inspection",
    };
}

function getOrCreateCacheByParserId<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    parserKey: string,
): CacheCollection<S> {
    return getOrCreateDefault<string, CacheCollection<S>>(
        CacheByParserId as Map<string, CacheCollection<S>>,
        parserKey,
        createCacheCollection,
    );
}

function getOrCreateDefault<K, V>(collection: Map<K, V>, key: K, createDefaultFn: () => V): V {
    const maybeValue: V | undefined = collection.get(key);

    if (maybeValue === undefined) {
        const value: V = createDefaultFn();
        collection.set(key, value);
        return value;
    } else {
        return maybeValue;
    }
}
