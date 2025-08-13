// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ICancellationToken } from "@microsoft/powerquery-parser";
import {
    DocumentSymbol,
    FoldingRange,
    Hover,
    Location,
    MarkupContent,
    SignatureHelp,
} from "vscode-languageserver-types";
import { Range, TextEdit } from "vscode-languageserver-textdocument";
import { expect } from "chai";
import { TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import { AbridgedDocumentSymbol, TAbridgedNodeScopeItem } from "./abridgedTestUtils";
import {
    AnalysisSettings,
    Inspection,
    InspectionSettings,
    PartialSemanticToken,
} from "../../powerquery-language-services";
import { NodeScope } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";
import { TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export async function assertContainsAutocompleteAnalysis(
    textWithPipe: string,
    expected: ReadonlyArray<string> | undefined,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Inspection.AutocompleteItem[] | undefined = await TestUtils.assertAutocompleteAnalysis(
        textWithPipe,
        settings,
        cancellationToken,
    );

    if (expected) {
        Assert.isDefined(actual);
        TestUtils.assertContainsAutocompleteItemLabels(expected, actual);
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualAutocompleteAnalysis(
    textWithPipe: string,
    expected: ReadonlyArray<string>,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: ReadonlyArray<Inspection.AutocompleteItem> | undefined = await TestUtils.assertAutocompleteAnalysis(
        textWithPipe,
        settings,
        cancellationToken,
    );

    Assert.isDefined(actual);
    TestUtils.assertContainsAutocompleteItemLabels(expected, actual);
}

export async function assertEqualDefinitionAnalysis(
    textWithPipe: string,
    expected: Range[] | undefined,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Location[] | undefined = await TestUtils.assertDefinitionAnalysis(
        textWithPipe,
        settings,
        cancellationToken,
    );

    if (actual) {
        Assert.isDefined(actual);
        expect(expected).to.deep.equal(actual.map((location: Location) => location.range));
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualDocumentSymbolsAnalysis(
    textWithPipe: string,
    expected: ReadonlyArray<AbridgedDocumentSymbol>,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: ReadonlyArray<DocumentSymbol> | undefined = await TestUtils.assertDocumentSymbolsAnalysis(
        textWithPipe,
        settings,
        cancellationToken,
    );

    Assert.isDefined(actual);
    expect(expected).to.deep.equal(TestUtils.abridgedDocumentSymbols(actual));
}

export async function assertEqualFoldingRangesAnalysis(
    text: string,
    expected: ReadonlyArray<FoldingRange>,
    settings: AnalysisSettings,
): Promise<void> {
    const foldingRanges: FoldingRange[] | undefined = await TestUtils.assertFoldingRangesAnalysis(text, settings);

    Assert.isDefined(foldingRanges);
    expect(foldingRanges).to.deep.equal(expected);
}

export async function assertEqualHoverAnalysis(
    textWithPipe: string,
    expected: string | undefined,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Hover | undefined = await TestUtils.assertHoverAnalysis(textWithPipe, settings, cancellationToken);

    if (expected) {
        Assert.isDefined(actual);
        expect(assertAsMarkupContent(actual.contents).value).to.equal(expected);
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualNodeScope(
    textWithPipe: string,
    expected: ReadonlyArray<TAbridgedNodeScopeItem>,
    inspectionSettings: InspectionSettings,
): Promise<void> {
    const nodeScope: NodeScope = await TestUtils.assertNodeScope(inspectionSettings, textWithPipe);
    const actual: ReadonlyArray<TAbridgedNodeScopeItem> = TestUtils.abridgedNodeScopeItems(nodeScope);

    const sortedExpected: ReadonlyArray<TAbridgedNodeScopeItem> = [...expected].sort(
        (left: TAbridgedNodeScopeItem, right: TAbridgedNodeScopeItem) =>
            left.identifier.localeCompare(right.identifier),
    );

    const sortedActual: ReadonlyArray<TAbridgedNodeScopeItem> = [...actual].sort(
        (left: TAbridgedNodeScopeItem, right: TAbridgedNodeScopeItem) =>
            left.identifier.localeCompare(right.identifier),
    );

    expect(sortedActual).to.have.deep.members(sortedExpected);
}

export async function assertEqualPartialSemanticTokensAnalysis(
    expected: ReadonlyArray<PartialSemanticToken> | undefined,
    settings: AnalysisSettings,
    text: string,
): Promise<void> {
    const semanticTokens: PartialSemanticToken[] | undefined = await TestUtils.assertPartialSemanticTokens(
        text,
        settings,
    );

    if (expected) {
        Assert.isDefined(semanticTokens);
        expect(semanticTokens).to.deep.equal(expected);
    } else {
        Assert.isUndefined(semanticTokens);
    }
}

export async function assertEqualRenameEdits(
    textWithPipe: string,
    newName: string,
    expected: TextEdit[] | undefined,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const textEdits: TextEdit[] | undefined = await TestUtils.assertRenameEdits(
        textWithPipe,
        newName,
        settings,
        cancellationToken,
    );

    if (expected) {
        Assert.isDefined(textEdits);
        expect(textEdits).to.deep.equal(expected);
    } else {
        Assert.isUndefined(textEdits);
    }
}

export async function assertEqualRootType(
    text: string,
    expected: TPowerQueryType,
    settings: InspectionSettings,
): Promise<void> {
    const actual: TPowerQueryType = await TestUtils.assertRootType(settings, text);

    return assertEqualPowerQueryType(expected, actual);
}

export async function assertEqualSignatureHelpAnalysis(
    textWithPipe: string,
    expected: SignatureHelp | undefined,
    settings: AnalysisSettings,
): Promise<void> {
    const signatureHelp: SignatureHelp | undefined = await TestUtils.assertSignatureHelpAnalysis(
        textWithPipe,
        settings,
    );

    if (expected) {
        Assert.isDefined(signatureHelp);
        expect(signatureHelp).to.deep.equal(expected);
    } else {
        Assert.isUndefined(signatureHelp);
    }
}

export function assertEqualScopeType(expected: Inspection.ScopeTypeByKey, actual: Inspection.ScopeTypeByKey): void {
    const expectedArray: ReadonlyArray<[string, TPowerQueryType]> = convertScopeTypeByKeyToArray(expected);
    const actualArray: ReadonlyArray<[string, TPowerQueryType]> = convertScopeTypeByKeyToArray(actual);

    expect(actualArray).to.have.deep.equal(expectedArray);
}

function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

function assertEqualPowerQueryType(expected: TPowerQueryType, actual: TPowerQueryType): void {
    // Use PowerQuery's built-in deep equality check which handles complex types (like nested Maps) correctly
    if (TypeUtils.isEqualType(expected, actual)) {
        return;
    }

    // The default error message doesn't handle maps well, so it's easiest to JSON.stringify the types for comparison.
    // We use a custom replacer to handle potential Maps.
    const jsonifiedExpected: string = JSON.stringify(expected, mapReplacer, 2);
    const jsonifiedActual: string = JSON.stringify(actual, mapReplacer, 2);

    expect(jsonifiedActual).to.equal(jsonifiedExpected, `PowerQuery types are not equal.`);
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
