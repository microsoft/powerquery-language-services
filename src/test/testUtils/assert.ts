// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, TaskUtils } from "@microsoft/powerquery-parser";
import { Hover, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";
import { expect } from "chai";

import * as TestConstants from "../testConstants";
import * as TestUtils from "./testUtils";
import {
    ActiveNode,
    ActiveNodeUtils,
    autocomplete,
    Inspected,
    InspectionInstance,
    TMaybeActiveNode,
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
    Inspection,
    InspectionSettings,
    TextDocument,
    validate,
    WorkspaceCacheUtils,
} from "../../powerquery-language-services";
import { TriedExpectedType, tryExpectedType } from "../../powerquery-language-services/inspection/expectedType";
import { ValidationResult } from "../../powerquery-language-services/validate/validationResult";

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
    let maybeParseError: PQP.Parser.ParseError.ParseError | undefined;

    if (PQP.TaskUtils.isLexStageError(triedLexParseTask) || PQP.TaskUtils.isParseStageCommonError(triedLexParseTask)) {
        throw new Error("should never be reached");
    } else if (PQP.TaskUtils.isParseStageError(triedLexParseTask)) {
        parseState = triedLexParseTask.parseState;
        maybeParseError = triedLexParseTask.error;
    } else {
        parseState = triedLexParseTask.parseState;
    }

    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(nodeIdMapCollection, position);

    const triedCurrentInvokeExpression: Promise<TriedCurrentInvokeExpression> = tryCurrentInvokeExpression(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        typeCache,
    );

    let triedNodeScope: Promise<TriedNodeScope>;
    let triedScopeType: Promise<TriedScopeType>;
    let triedExpectedType: TriedExpectedType;

    if (ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        const activeNode: ActiveNode = maybeActiveNode;

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
        maybeActiveNode,
        await autocomplete(settings, parseState, typeCache, maybeActiveNode, maybeParseError),
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

export function assertIsDefined<T>(
    maybeValue: T | undefined,
    maybeMessage?: string,
    maybeDetails?: object,
): asserts maybeValue is NonNullable<T> {
    Assert.isDefined(maybeValue, maybeMessage, maybeDetails);
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
