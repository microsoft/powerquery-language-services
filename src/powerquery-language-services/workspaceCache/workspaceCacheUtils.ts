// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";
import type { Position, TextDocument, TextDocumentContentChangeEvent } from "../commonTypes";
import { TypeCacheUtils } from "../inspection";
import type { CacheItem, InspectionCacheItem, InspectionTask, LexCacheItem, ParseCacheItem } from "./workspaceCache";

export function assertIsInspectionTask(cacheItem: CacheItem): asserts cacheItem is InspectionTask {
    if (!isInspectionTask(cacheItem)) {
        throw new PQP.CommonError.InvariantError(`expected cacheItem to be a different stage`, {
            expected: "Inspection",
            actual: cacheItem?.stage,
        });
    }
}

// TODO: is the position key valid for a single intellisense operation,
// or would it be the same for multiple invocations?
export function close(textDocument: TextDocument): void {
    AllCaches.forEach(map => {
        map.delete(textDocument.uri);
    });
}

export function getLexerState(textDocument: TextDocument, maybeLocale: string | undefined): LexCacheItem {
    return getOrCreate(LexerTaskCache, textDocument, maybeLocale, createLexCacheItem);
}

export function getTriedParse(textDocument: TextDocument, maybeLocale: string | undefined): ParseCacheItem {
    return getOrCreate(ParseTaskCache, textDocument, maybeLocale, createParseCacheItem);
}

// We can't easily reuse getOrCreate because inspections require a position argument.
// This results in a double layer cache.
export function getTriedInspection(
    textDocument: TextDocument,
    position: Position,
    externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn,
    maybeLocale: string | undefined,
): InspectionCacheItem {
    const cacheKey: string = textDocument.uri;
    const maybePositionCache: undefined | InspectionMap = InspectionCache.get(cacheKey);

    let positionCache: WeakMap<Position, InspectionCacheItem>;
    // document has been inspected before
    if (maybePositionCache !== undefined) {
        positionCache = maybePositionCache;
    } else {
        positionCache = new WeakMap();
        InspectionCache.set(textDocument.uri, positionCache);
    }

    if (positionCache.has(position)) {
        return positionCache.get(position);
    } else {
        const value:
            | InspectionCacheItem
            | PQP.Task.TriedLexTask
            | PQP.Task.TriedParseTask
            | undefined = maybeCreateInspection(textDocument, position, externalTypeResolver, maybeLocale);
        positionCache.set(position, value);
        return value;
    }
}

export function getTypeCache(textDocument: TextDocument): Inspection.TypeCache {
    return getOrCreate(TypeCacheCache, textDocument, undefined, createTypeCache);
}

export function isInspectionTask(cacheItem: CacheItem): cacheItem is InspectionTask {
    return cacheItem?.stage === "Inspection";
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

// Notice that the value type for WeakMap includes undefined.
// Take the scenario where an inspection was requested on a document that was not parsable,
// then createTriedInspection would return undefined as you can't inspect something that wasn't parsed.
// If we used WeakMap.get(...) we wouldn't know if an undefined was returned because of a cache miss
// or that we we couldn't do an inspection.
type InspectionMap = WeakMap<Position, InspectionCacheItem>;

const LexerTaskCache: Map<string, LexCacheItem> = new Map();
const ParseTaskCache: Map<string, ParseCacheItem> = new Map();
const InspectionCache: Map<string, InspectionMap> = new Map();
const TypeCacheCache: Map<string, TypeCache> = new Map();

const AllCaches: Map<string, any>[] = [LexerTaskCache, ParseTaskCache, InspectionCache, TypeCacheCache];

function getOrCreate<T>(
    cache: Map<string, T>,
    textDocument: TextDocument,
    maybeLocale: string | undefined,
    createFn: (textDocument: TextDocument, maybeLocale: string | undefined) => T,
): T {
    const cacheKey: string = textDocument.uri;
    const maybeValue: T | undefined = cache.get(cacheKey);

    if (maybeValue === undefined) {
        const value: T = createFn(textDocument, maybeLocale);
        cache.set(cacheKey, value);
        return value;
    } else {
        return maybeValue;
    }
}

function createLexCacheItem(textDocument: TextDocument, maybeLocale: string | undefined): LexCacheItem {
    return PQP.TaskUtils.tryLex(getSettings(undefined, maybeLocale), textDocument.getText());
}

function createParseCacheItem(textDocument: TextDocument, maybeLocale: string | undefined): ParseCacheItem {
    const triedLexTask: PQP.Task.TriedLexTask = getLexerState(textDocument, maybeLocale);
    if (!PQP.TaskUtils.isLexStageOk(triedLexTask)) {
        return triedLexTask;
    }

    const settings: PQP.ParseSettings = getSettings(undefined, maybeLocale);
    return PQP.TaskUtils.tryParse(settings, triedLexTask.lexerSnapshot);
}

function createTypeCache(_textDocument: TextDocument, _maybeLocale: string | undefined): Inspection.TypeCache {
    return TypeCacheUtils.createTypeCache();
}

// We're allowed to return undefined because if a document wasn't parsed then there's no way to perform an inspection.
function maybeCreateInspection(
    textDocument: TextDocument,
    position: Position,
    externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn,
    maybeLocale: string | undefined,
): InspectionCacheItem {
    const triedParseTask: PQP.Task.TriedLexTask | PQP.Task.TriedParseTask | PQP.Task.TriedParseTask = getTriedParse(
        textDocument,
        maybeLocale,
    );
    if (!PQP.TaskUtils.isParseStage(triedParseTask) || PQP.TaskUtils.isParseStageCommonError(triedParseTask)) {
        return triedParseTask;
    }

    const settings: PQP.ParseSettings & Inspection.InspectionSettings = getSettings(externalTypeResolver, maybeLocale);
    return {
        ...Inspection.inspection(
            settings,
            triedParseTask.parseState,
            PQP.TaskUtils.isParseStageParseError(triedParseTask) ? triedParseTask.error : undefined,
            {
                lineNumber: position.line,
                lineCodeUnit: position.character,
            },
        ),
        stage: "Inspection",
    };
}

function getSettings(
    maybeExternalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn | undefined,
    maybeLocale: string | undefined,
): PQP.Settings & Inspection.InspectionSettings {
    return {
        ...PQP.DefaultSettings,
        locale: maybeLocale ?? PQP.DefaultSettings.locale,
        maybeExternalTypeResolver,
    };
}
