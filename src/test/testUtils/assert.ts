// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, CommonError, Result, TaskUtils } from "@microsoft/powerquery-parser";
import { Hover, Location, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";
import { expect } from "chai";
import { Range } from "vscode-languageserver-textdocument";

import * as TestConstants from "../testConstants";
import * as TestUtils from "./testUtils";
import {
    ActiveNodeUtils,
    autocomplete,
    Inspected,
    InspectionInstance,
    TActiveNode,
    TriedCurrentInvokeExpression,
    TriedNodeScope,
    TriedScopeType,
    tryCurrentInvokeExpression,
    tryNodeScope,
    tryScopeType,
    TypeCache,
    TypeCacheUtils,
} from "../../powerquery-language-services/inspection";
import {
    AnalysisSettings,
    Inspection,
    InspectionSettings,
    TextDocument,
    validate,
    ValidationSettings,
} from "../../powerquery-language-services";
import { TriedExpectedType, tryExpectedType } from "../../powerquery-language-services/inspection/expectedType";
import { ValidateOk } from "../../powerquery-language-services/validate/validateOk";

export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

export async function assertGetInspectionInstance(
    settings: InspectionSettings,
    text: string,
    position: Position,
    typeCache: TypeCache = TypeCacheUtils.createEmptyCache(),
): Promise<Inspected> {
    const triedLexParseTask: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStage(triedLexParseTask);

    let parseState: PQP.Parser.ParseState;
    let parseError: PQP.Parser.ParseError.ParseError | undefined;

    if (PQP.TaskUtils.isLexStageError(triedLexParseTask) || PQP.TaskUtils.isParseStageCommonError(triedLexParseTask)) {
        throw new Error("should never be reached");
    } else if (PQP.TaskUtils.isParseStageError(triedLexParseTask)) {
        parseState = triedLexParseTask.parseState;
        parseError = triedLexParseTask.error;
    } else {
        parseState = triedLexParseTask.parseState;
    }

    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const activeNode: TActiveNode = ActiveNodeUtils.activeNode(nodeIdMapCollection, position);

    const triedCurrentInvokeExpression: Promise<TriedCurrentInvokeExpression> = tryCurrentInvokeExpression(
        settings,
        nodeIdMapCollection,
        activeNode,
        typeCache,
    );

    let triedNodeScope: Promise<TriedNodeScope>;
    let triedScopeType: Promise<TriedScopeType>;
    let triedExpectedType: TriedExpectedType;

    if (ActiveNodeUtils.isPositionInBounds(activeNode)) {
        triedNodeScope = tryNodeScope(
            settings,
            nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            typeCache.scopeById,
        );

        const ancestryLeaf: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = Promise.resolve(PQP.ResultUtils.boxOk(new Map()));
        triedScopeType = Promise.resolve(PQP.ResultUtils.boxOk(new Map()));
        triedExpectedType = PQP.ResultUtils.boxOk(undefined);
    }

    return new InspectionInstance(
        settings,
        nodeIdMapCollection,
        activeNode,
        await autocomplete(settings, parseState, typeCache, activeNode, parseError),
        triedCurrentInvokeExpression,
        triedNodeScope,
        triedScopeType,
        triedExpectedType,
        typeCache,
        parseState,
    );
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
            ActiveNodeUtils.activeNode(triedLexParseTask.nodeIdMapCollection, position),
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
            ActiveNodeUtils.activeNode(triedLexParseTask.nodeIdMapCollection, position),
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
        autocompleteItems.find((completionitem: Inspection.AutocompleteItem) => completionitem.label === label),
        `did not find the expected completion item`,
        {
            label,
            completionItemLabels: autocompleteItems.map(
                (completionItem: Inspection.AutocompleteItem) => completionItem.label,
            ),
        },
    );
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
    const lines: ReadonlyArray<string> = text.split("\n");
    const numLines: number = lines.length;

    let position: Position | undefined;

    for (let lineIndex: number = 0; lineIndex < numLines; lineIndex += 1) {
        const line: string = lines[lineIndex];
        const indexOfPipe: number = line.indexOf("|");

        if (indexOfPipe !== -1) {
            position = {
                line: lineIndex,
                character: indexOfPipe,
            };

            break;
        }
    }

    if (position === undefined) {
        throw new Error(`couldn't find a pipe character in the input text`);
    }

    return [text.replace("|", ""), position];
}

export async function assertGetValidateOk(
    document: TextDocument,
    analysisSettings: AnalysisSettings = TestConstants.SimpleLibraryAnalysisSettings,
    ValidationSettings: ValidationSettings = TestConstants.SimpleValidateAllSettings,
): Promise<ValidateOk> {
    const triedValidation: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
        document,
        analysisSettings,
        ValidationSettings,
    );

    Assert.isOk(triedValidation);
    Assert.isDefined(triedValidation.value);

    return triedValidation.value;
}

export function assertEqualHover(expected: string, actual: Hover): void {
    const contents: string = assertAsMarkupContent(actual.contents).value;
    expect(contents).to.equal(expected);
}

export function assertEqualLocation(expected: ReadonlyArray<Range>, actual: ReadonlyArray<Location>): void {
    const actualRange: ReadonlyArray<Range> = actual.map((location: Location) => location.range);
    expect(actualRange).deep.equals(expected);
}

export function assertIsDefined<T>(
    value: T | undefined,
    message?: string,
    details?: object,
): asserts value is NonNullable<T> {
    Assert.isDefined(value, message, details);
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
    expected = [...expected].sort();
    const actualLabels: ReadonlyArray<string> = actual.map((item: Inspection.AutocompleteItem) => item.label).sort();

    expect(actualLabels).to.deep.equal(expected);
}

export function assertContainsAutocompleteItemLabels(
    expected: ReadonlyArray<string>,
    actual: ReadonlyArray<Inspection.AutocompleteItem>,
): void {
    const actualLabels: ReadonlyArray<string> = actual.map((item: Inspection.AutocompleteItem) => item.label);
    expect(actualLabels).to.include.members(expected);
}

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.createAbridgedSignatureHelp(actual)).deep.equals(expected);
}
