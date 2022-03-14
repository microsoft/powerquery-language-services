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
    WorkspaceCacheUtils,
} from "../../powerquery-language-services";
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

export async function assertGetInspection(document: TextDocument, position: Position): Promise<Inspection.Inspected> {
    const maybeInspected: Inspection.Inspected | undefined = await WorkspaceCacheUtils.getOrCreateInspectedPromise(
        document,
        TestConstants.SimpleInspectionSettings,
        position,
    );

    Assert.isDefined(maybeInspected);

    return maybeInspected;
}

export async function assertGetLexParseOk(settings: PQP.Settings, text: string): Promise<PQP.Task.ParseTaskOk> {
    const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageOk(triedLexParseTask);

    return triedLexParseTask;
}

export async function assertGetLexParseError(
    settings: PQP.Settings,
    text: string,
): Promise<PQP.Task.ParseTaskParseError> {
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

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.createAbridgedSignatureHelp(actual)).deep.equals(expected);
}
