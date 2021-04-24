// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Position } from "vscode-languageserver-types";

import { Inspection } from "..";
import type { InspectionCacheItem, LexCacheItem, ParseCacheItem, WorkspaceCacheSettings } from "./workspaceCache";

const CacheByParserId: Map<string, CacheCollection> = new Map();

interface CacheCollection {
    readonly lex: Map<string, LexCacheItem>;
    readonly parse: Map<string, ParseCacheItem>;
    readonly inspection: Map<string, Map<Position, InspectionCacheItem>>;
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
    lexSettings: PQP.LexSettings & PQP.ParseSettings<S>,
): ParseCacheItem<S> {
    const cacheCollection: CacheCollection = getOrCreateCacheByParserId(workspaceCacheSettings.parserId);

    return getOrCreateDefault(cacheCollection.lex, createCacheKey(workspaceCacheSettings), () =>
        createParseCacheItem(workspaceCacheSettings, lexSettings),
    );
}

// This code is a bit more complex as there's two layers of cache indirection,
// first by the usual parserId, then by position (as some inspections are position sensitive).
export function getOrCreateInspection(
    workspaceCacheSettings: WorkspaceCacheSettings,
    inspectionSettings: Inspection.InspectionSettings,
    position: Position,
): InspectionCacheItem {
    const cacheCollection: CacheCollection = getOrCreateCacheByParserId(workspaceCacheSettings.parserId);
    const cacheKey: string = createCacheKey(workspaceCacheSettings);
    const maybeByCacheKey: Map<Position, InspectionCacheItem> | undefined = cacheCollection.inspection.get(cacheKey);

    let byCacheKey: Map<Position, InspectionCacheItem>;
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

function createCacheCollection(): CacheCollection {
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

function getOrCreateCacheByParserId(parserKey: string): CacheCollection {
    return getOrCreateDefault(CacheByParserId, parserKey, createCacheCollection);
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
