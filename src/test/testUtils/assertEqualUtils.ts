// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ICancellationToken, Settings } from "@microsoft/powerquery-parser";
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

import { AbridgedDocumentSymbol, TAbridgedNodeScopeItem } from "./abridgedUtils";
import {
    AnalysisSettings,
    Inspection,
    InspectionSettings,
    PartialSemanticToken,
} from "../../powerquery-language-services";
import { NodeScope } from "../../powerquery-language-services/inspection";
import { TestUtils } from "..";

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
    settings: Settings,
): Promise<void> {
    const nodeScope: NodeScope = await TestUtils.assertNodeScope(settings, textWithPipe);
    const actual: ReadonlyArray<TAbridgedNodeScopeItem> = TestUtils.abridgedNodeScopeItems(nodeScope);
    expect(actual).deep.equal(expected);
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
    expect(actual).to.deep.equal(expected);
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

export async function assertEqualScopeType(
    textWithPipe: string,
    expected: Inspection.ScopeTypeByKey,
    settings: InspectionSettings,
): Promise<void> {
    const actual: Inspection.ScopeTypeByKey = await TestUtils.assertScopeType(settings, textWithPipe);
    expect(actual).to.deep.equal(expected);
}

function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}
