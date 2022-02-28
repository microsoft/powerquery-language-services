// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, TaskUtils } from "@microsoft/powerquery-parser";
import { Hover, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";
import { expect } from "chai";

import * as TestConstants from "../testConstants";
import * as TestUtils from "./testUtils";
import { ActiveNodeUtils, TypeCacheUtils } from "../../powerquery-language-services/inspection";
import {
    Inspection,
    InspectionSettings,
    TextDocument,
    validate,
    WorkspaceCache,
    WorkspaceCacheUtils,
} from "../../powerquery-language-services";
import { CacheItem } from "../../powerquery-language-services/workspaceCache/workspaceCache";
import { MockDocument } from "../mockDocument";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

export async function assertGetAutocomplete(
    settings: InspectionSettings,
    text: string,
    position: Position,
): Promise<Inspection.Autocomplete> {
    // TODO: figure out why this exception is needed
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStage(triedLexParseTask);

    if (PQP.TaskUtils.isParseStageOk(triedLexParseTask)) {
        return Inspection.autocomplete(
            settings,
            triedLexParseTask.parseState,
            TypeCacheUtils.createEmptyCache(),
            ActiveNodeUtils.maybeActiveNode(triedLexParseTask.nodeIdMapCollection, position),
            undefined,
        );
    } else if (PQP.TaskUtils.isParseStageError(triedLexParseTask)) {
        if (triedLexParseTask.isCommonError) {
            throw triedLexParseTask.error;
        }

        return Inspection.autocomplete(
            settings,
            triedLexParseTask.parseState,
            TypeCacheUtils.createEmptyCache(),
            ActiveNodeUtils.maybeActiveNode(triedLexParseTask.nodeIdMapCollection, position),
            triedLexParseTask.error,
        );
    } else {
        throw new Error("should never be reached");
    }
}

export function assertGetAutocompleteItem(
    label: string,
    autocompleteItems: ReadonlyArray<Inspection.AutocompleteItem>,
): Inspection.AutocompleteItem {
    return Assert.asDefined(
        autocompleteItems.find((completionitem: Inspection.AutocompleteItem) => completionitem.label === "Test.Foo"),
        `did not find the expected completion item`,
        {
            label,
            completionItemLabels: autocompleteItems.map(
                (completionItem: Inspection.AutocompleteItem) => completionItem.label,
            ),
        },
    );
}

export async function assertGetInspectionCacheItem(
    document: MockDocument,
    position: Position,
): Promise<Inspection.Inspection> {
    const cacheItem: WorkspaceCache.InspectionCacheItem = await WorkspaceCacheUtils.getOrCreateInspection(
        document,
        TestConstants.SimpleInspectionSettings,
        position,
    );

    assertIsDefined(cacheItem);
    assertInspectionCacheItemOk(cacheItem);

    return cacheItem;
}

export async function assertGetLexParseOk(settings: PQP.Settings, text: string): Promise<PQP.Task.ParseTaskOk> {
    // TODO: figure out why this exception is needed
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageOk(triedLexParseTask);

    return triedLexParseTask;
}

export async function assertGetLexParseError(
    settings: PQP.Settings,
    text: string,
): Promise<PQP.Task.ParseTaskParseError> {
    // TODO: figure out why this exception is needed
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageParseError(triedLexParseTask);

    return triedLexParseTask;
}

// Only works with single line expressions
export function assertGetTextWithPosition(text: string): [string, Position] {
    const indexOfPipe: number = text.indexOf("|");

    expect(indexOfPipe).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfPipe).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Position = {
        line: 0,
        character: indexOfPipe,
    };

    return [text.replace("|", ""), position];
}

export async function assertGetValidationResult(document: TextDocument): Promise<ValidationResult> {
    return await validate(document, TestConstants.SimpleValidationSettings);
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

export function assertAutocompleteItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<Inspection.AutocompleteItem>,
): void {
    const actualLabels: ReadonlyArray<string> = actual.map((item: Inspection.AutocompleteItem) => item.label);
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

export function assertParserCacheItemError(
    cacheItem: WorkspaceCache.CacheItem,
): asserts cacheItem is PQP.Task.ParseTaskOk {
    assertNotInspectionCacheItem(cacheItem);
    TaskUtils.assertIsParseStageParseError(cacheItem);
}

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.createAbridgedSignatureHelp(actual)).deep.equals(expected);
}
