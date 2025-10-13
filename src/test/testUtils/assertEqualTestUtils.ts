// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "bun:test";

import { Assert, type ICancellationToken } from "@microsoft/powerquery-parser";
import {
    type DocumentSymbol,
    type FoldingRange,
    type Hover,
    type Location,
    MarkupContent,
    type SignatureHelp,
} from "vscode-languageserver-types";
import { type Range, type TextEdit } from "vscode-languageserver-textdocument";
import { type TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import {
    type AbridgedAutocompleteItem,
    type AbridgedDocumentSymbol,
    type TAbridgedNodeScopeItem,
} from "./abridgedTestUtils";
import {
    type AnalysisSettings,
    type Inspection,
    type InspectionSettings,
    type PartialSemanticToken,
} from "../../powerquery-language-services";
import { type NodeScope } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";
import { TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export function assertEqualAbridgedAutocompleteItems(params: {
    readonly expected: ReadonlyArray<AbridgedAutocompleteItem>;
    readonly actual: ReadonlyArray<AbridgedAutocompleteItem>;
}): void {
    expect(params.actual).toEqual(expect.arrayContaining(params.expected));
}

export async function assertEqualDefinitionAnalysis(params: {
    readonly textWithPipe: string;
    readonly expected: Range[] | undefined;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<void> {
    const actual: Location[] | undefined = await TestUtils.assertDefinitionAnalysis(params);

    if (actual) {
        Assert.isDefined(actual);
        expect(params.expected).toEqual(actual.map((location: Location) => location.range));
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualDocumentSymbolsAnalysis(params: {
    readonly text: string;
    readonly expected: ReadonlyArray<AbridgedDocumentSymbol>;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<void> {
    const actual: ReadonlyArray<DocumentSymbol> | undefined = await TestUtils.assertDocumentSymbolsAnalysis(params);

    Assert.isDefined(actual);
    expect(params.expected).toEqual(TestUtils.abridgedDocumentSymbols(actual));
}

export async function assertEqualFoldingRangesAnalysis(params: {
    readonly text: string;
    readonly expected: ReadonlyArray<FoldingRange>;
    readonly analysisSettings: AnalysisSettings;
}): Promise<void> {
    const foldingRanges: FoldingRange[] | undefined = await TestUtils.assertFoldingRangesAnalysis(params);

    Assert.isDefined(foldingRanges);
    expect(foldingRanges).toEqual(Array.from(params.expected));
}

export async function assertEqualHoverAnalysis(params: {
    readonly textWithPipe: string;
    readonly expected: string | undefined;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<void> {
    const actual: Hover | undefined = await TestUtils.assertHoverAnalysis(params);

    if (params.expected) {
        Assert.isDefined(actual);
        expect(assertAsMarkupContent(actual.contents).value).toBe(params.expected);
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualNodeScope(params: {
    readonly textWithPipe: string;
    readonly expected: ReadonlyArray<TAbridgedNodeScopeItem>;
    readonly inspectionSettings: InspectionSettings;
}): Promise<void> {
    const nodeScope: NodeScope | undefined = await TestUtils.assertNodeScopeOrUndefined(params);
    const actual: ReadonlyArray<TAbridgedNodeScopeItem> = nodeScope ? TestUtils.abridgedNodeScopeItems(nodeScope) : [];

    const sortedExpected: ReadonlyArray<TAbridgedNodeScopeItem> = [...params.expected].sort(
        (left: TAbridgedNodeScopeItem, right: TAbridgedNodeScopeItem) =>
            left.identifier.localeCompare(right.identifier),
    );

    const sortedActual: ReadonlyArray<TAbridgedNodeScopeItem> = [...actual].sort(
        (left: TAbridgedNodeScopeItem, right: TAbridgedNodeScopeItem) =>
            left.identifier.localeCompare(right.identifier),
    );

    expect(sortedActual).toEqual(expect.arrayContaining(sortedExpected));
}

export async function assertEqualPartialSemanticTokensAnalysis(params: {
    readonly expected: ReadonlyArray<PartialSemanticToken> | undefined;
    readonly analysisSettings: AnalysisSettings;
    readonly text: string;
}): Promise<void> {
    const semanticTokens: PartialSemanticToken[] | undefined = await TestUtils.assertPartialSemanticTokens(params);

    if (params.expected) {
        Assert.isDefined(semanticTokens);
        expect(semanticTokens).toEqual(Array.from(params.expected));
    } else {
        Assert.isUndefined(semanticTokens);
    }
}

export async function assertEqualRenameEdits(params: {
    readonly textWithPipe: string;
    readonly newName: string;
    readonly expected: TextEdit[] | undefined;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<void> {
    const textEdits: TextEdit[] | undefined = await TestUtils.assertRenameEdits(params);

    if (params.expected) {
        Assert.isDefined(textEdits);
        expect(textEdits).toEqual(params.expected);
    } else {
        Assert.isUndefined(textEdits);
    }
}

export async function assertEqualRootType(params: {
    readonly text: string;
    readonly expected: TPowerQueryType;
    readonly settings: InspectionSettings;
}): Promise<void> {
    const actual: TPowerQueryType = await TestUtils.assertRootType({
        text: params.text,
        inspectionSettings: params.settings,
    });

    return assertEqualPowerQueryType({
        actual,
        expected: params.expected,
    });
}

export async function assertEqualSignatureHelpAnalysis(params: {
    readonly textWithPipe: string;
    readonly expected: SignatureHelp | undefined;
    readonly analysisSettings: AnalysisSettings;
}): Promise<void> {
    const signatureHelp: SignatureHelp | undefined = await TestUtils.assertSignatureHelpAnalysis(params);

    if (params.expected) {
        Assert.isDefined(signatureHelp);
        expect(signatureHelp).toEqual(params.expected);
    } else {
        Assert.isUndefined(signatureHelp);
    }
}

export function assertEqualScopeType(params: {
    readonly expected: Inspection.ScopeTypeByKey;
    readonly actual: Inspection.ScopeTypeByKey;
}): void {
    const expectedArray: ReadonlyArray<[string, TPowerQueryType]> = convertScopeTypeByKeyToArray(params.expected);
    const actualArray: ReadonlyArray<[string, TPowerQueryType]> = convertScopeTypeByKeyToArray(params.actual);

    expect(actualArray).toEqual(expect.arrayContaining(expectedArray));
}

function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

function assertEqualPowerQueryType(params: {
    readonly expected: TPowerQueryType;
    readonly actual: TPowerQueryType;
}): void {
    // Use PowerQuery's built-in deep equality check which handles complex types (like nested Maps) correctly
    if (TypeUtils.isEqualType(params.expected, params.actual)) {
        return;
    }

    // The default error message doesn't handle maps well, so it's easiest to JSON.stringify the types for comparison.
    // We use a custom replacer to handle potential Maps.
    const jsonifiedExpected: string = JSON.stringify(params.expected, mapReplacer, 2);
    const jsonifiedActual: string = JSON.stringify(params.actual, mapReplacer, 2);

    expect(jsonifiedActual).toBe(jsonifiedExpected); // PowerQuery types are not equal
}

function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

function convertScopeTypeByKeyToArray(
    scopeTypeByKey: Inspection.ScopeTypeByKey,
): ReadonlyArray<[string, TPowerQueryType]> {
    return Array.from(scopeTypeByKey.entries()).map(([key, value]: [string, TPowerQueryType]) => [key, value]);
}

function mapReplacer(_key: string, value: any): any {
    if (value instanceof Map) {
        return {
            __type: "Map",
            value: Array.from(value.entries()),
        };
    }

    return value;
}
