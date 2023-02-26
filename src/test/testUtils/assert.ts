// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Hover, Location, MarkupContent, Position, SignatureHelp } from "vscode-languageserver-types";
import { Parser, ResultUtils, Task, TaskUtils } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { Range } from "vscode-languageserver-textdocument";

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
import { Inspection, InspectionSettings } from "../../powerquery-language-services";
import { TriedExpectedType, tryExpectedType } from "../../powerquery-language-services/inspection/expectedType";
import { TestUtils } from "..";

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
    const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStage(triedLexParseTask);

    let parseState: Parser.ParseState;
    let parseError: Parser.ParseError.ParseError | undefined;

    if (TaskUtils.isLexStageError(triedLexParseTask) || TaskUtils.isParseStageCommonError(triedLexParseTask)) {
        throw new Error("should never be reached");
    } else if (TaskUtils.isParseStageError(triedLexParseTask)) {
        parseState = triedLexParseTask.parseState;
        parseError = triedLexParseTask.error;
    } else {
        parseState = triedLexParseTask.parseState;
    }

    const nodeIdMapCollection: Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
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

        const ancestryLeaf: Parser.TXorNode = Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
        triedScopeType = tryScopeType(settings, nodeIdMapCollection, ancestryLeaf.node.id, typeCache);

        triedExpectedType = tryExpectedType(settings, activeNode);
    } else {
        triedNodeScope = Promise.resolve(ResultUtils.boxOk(new Map()));
        triedScopeType = Promise.resolve(ResultUtils.boxOk(new Map()));
        triedExpectedType = ResultUtils.boxOk(undefined);
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

export function assertEqualLocation(expected: ReadonlyArray<Range>, actual: ReadonlyArray<Location>): void {
    const actualRange: ReadonlyArray<Range> = actual.map((location: Location) => location.range);
    expect(actualRange).deep.equals(expected);
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

export function assertSignatureHelp(expected: TestUtils.AbridgedSignatureHelp, actual: SignatureHelp): void {
    expect(TestUtils.abridgedSignatureHelp(actual)).deep.equals(expected);
}
