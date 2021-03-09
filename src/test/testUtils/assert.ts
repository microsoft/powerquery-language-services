// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as PQP from "@microsoft/powerquery-parser";
import * as TestUtils from "./testUtils";

import { Assert, TaskUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { CompletionItem, Hover, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";

import * as TestConstants from "../testConstants";

import { Inspection, WorkspaceCache, WorkspaceCacheUtils } from "../../powerquery-language-services";
import { ActiveNodeUtils, InspectionSettings } from "../../powerquery-language-services/inspection";
import { CacheItem } from "../../powerquery-language-services/workspaceCache/workspaceCache";
import { MockDocument } from "../mockDocument";

export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);
    return value;
}

export function assertGetAutocomplete<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.Autocomplete {
    const triedLexParseTask: PQP.Task.TriedLexParseTask<S> = PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStage(triedLexParseTask);

    if (PQP.TaskUtils.isParseStageOk(triedLexParseTask)) {
        return Inspection.autocomplete(
            settings,
            triedLexParseTask.parseState,
            Inspection.createTypeCache(),
            ActiveNodeUtils.maybeActiveNode(
                triedLexParseTask.nodeIdMapCollection,
                triedLexParseTask.leafNodeIds,
                position,
            ),
            undefined,
        );
    } else if (PQP.TaskUtils.isParseStageError(triedLexParseTask)) {
        if (triedLexParseTask.isCommonError) {
            throw triedLexParseTask.error;
        }

        return Inspection.autocomplete(
            settings,
            triedLexParseTask.parseState,
            Inspection.createTypeCache(),
            ActiveNodeUtils.maybeActiveNode(
                triedLexParseTask.nodeIdMapCollection,
                triedLexParseTask.leafNodeIds,
                position,
            ),
            triedLexParseTask.error,
        );
    } else {
        throw new Error("should never be reached");
    }
}

export function assertGetCompletionItem(label: string, completionItems: ReadonlyArray<CompletionItem>): CompletionItem {
    return Assert.asDefined(
        completionItems.find((completionitem: CompletionItem) => completionitem.label === "Test.Foo"),
        `did not find the expected completion item`,
        { label, completionItemLabels: completionItems.map((completionItem: CompletionItem) => completionItem.label) },
    );
}

export function assertGetInspectionCacheItem(document: MockDocument, position: Position): Inspection.Inspection {
    const cacheItem: WorkspaceCache.InspectionCacheItem = WorkspaceCacheUtils.getTriedInspection(
        document,
        position,
        TestConstants.SimpleExternalTypeResolver,
        undefined,
    );
    assertIsDefined(cacheItem);
    assertInspectionCacheItemOk(cacheItem);
    return cacheItem;
}

export function assertGetLexParseOk<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.Settings<S>,
    text: string,
): PQP.Task.ParseTaskOk<S> {
    const triedLexParseTask: PQP.Task.TriedLexParseTask<S> = PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageOk(triedLexParseTask);

    return triedLexParseTask;
}

export function assertGetLexParseErr<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.Settings<S>,
    text: string,
): PQP.Task.ParseTaskParseError<S> {
    const triedLexParseTask: PQP.Task.TriedLexParseTask<S> = PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageParseError(triedLexParseTask);

    return triedLexParseTask;
}

// Only works with single line expressions
export function assertGetTextWithPosition(text: string): [string, Inspection.Position] {
    const indexOfPipe: number = text.indexOf("|");

    expect(indexOfPipe).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfPipe).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Inspection.Position = {
        lineNumber: 0,
        lineCodeUnit: indexOfPipe,
    };

    return [text.replace("|", ""), position];
}

export function assertHover(expected: string, actual: Hover): void {
    const contents: string = assertAsMarkupContent(actual.contents).value;
    expect(contents).to.equal(expected);
}

export function assertIsDefined<T>(maybeValue: T | undefined): asserts maybeValue is NonNullable<T> {
    Assert.isDefined(maybeValue);
}

export function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

export function assertCompletionItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<CompletionItem>,
): void {
    const actualLabels: ReadonlyArray<string> = actual.map((item: CompletionItem) => item.label);
    expect(actualLabels).to.include.members(expected);
}

export function assertCacheItemOk(cacheItem: WorkspaceCache.CacheItem): asserts cacheItem is CacheItem {
    if (cacheItem !== undefined && !WorkspaceCacheUtils.isInspectionTask(cacheItem)) {
        TaskUtils.assertIsOk(cacheItem);
    }
}

export function assertInspectionCacheItemOk(
    cacheItem: WorkspaceCache.InspectionCacheItem,
): asserts cacheItem is WorkspaceCache.InspectionTask {
    WorkspaceCacheUtils.assertIsInspectionTask(cacheItem);
}

export function assertLexerCacheItemOk(cacheItem: WorkspaceCache.CacheItem): asserts cacheItem is PQP.Task.LexTaskOk {
    assertNotInspectionCacheItem(cacheItem);
    TaskUtils.assertIsLexStageOk(cacheItem);
}

export function assertNotInspectionCacheItem(
    cacheItem: WorkspaceCache.CacheItem,
): asserts cacheItem is Exclude<WorkspaceCache.CacheItem, undefined | WorkspaceCache.InspectionTask> {
    if (cacheItem === undefined || cacheItem.stage === "Inspection") {
        throw new Error(`expected cacheItem to not be a Inspection cache item`);
    }
}

export function assertParserCacheItemOk(
    cacheItem: WorkspaceCache.CacheItem,
): asserts cacheItem is PQP.Task.ParseTaskOk {
    assertNotInspectionCacheItem(cacheItem);
    TaskUtils.assertIsParseStageOk(cacheItem);
}

export function assertParserCacheItemErr(
    cacheItem: WorkspaceCache.CacheItem,
): asserts cacheItem is PQP.Task.ParseTaskOk {
    assertNotInspectionCacheItem(cacheItem);
    TaskUtils.assertIsParseStageParseError(cacheItem);
}

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.createAbridgedSignatureHelp(actual)).deep.equals(expected);
}
