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
    expected: ReadonlyArray<string> | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Inspection.AutocompleteItem[] | undefined = await TestUtils.assertAutocompleteAnalysis(
        settings,
        textWithPipe,
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
    expected: ReadonlyArray<string>,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: ReadonlyArray<Inspection.AutocompleteItem> | undefined = await TestUtils.assertAutocompleteAnalysis(
        settings,
        textWithPipe,
        cancellationToken,
    );

    Assert.isDefined(actual);
    TestUtils.assertContainsAutocompleteItemLabels(expected, actual);
}

export async function assertEqualDefinitionAnalysis(
    expected: Range[] | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Location[] | undefined = await TestUtils.assertDefinitionAnalysis(
        settings,
        textWithPipe,
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
        settings,
        textWithPipe,
        cancellationToken,
    );

    Assert.isDefined(actual);
    expect(expected).to.deep.equal(TestUtils.abridgedDocumentSymbols(actual));
}

export async function assertEqualFoldingRangesAnalysis(
    expected: ReadonlyArray<FoldingRange>,
    settings: AnalysisSettings,
    text: string,
): Promise<void> {
    const foldingRanges: FoldingRange[] | undefined = await TestUtils.assertFoldingRangesAnalysis(settings, text);

    Assert.isDefined(foldingRanges);
    expect(foldingRanges).to.deep.equal(expected);
}

export async function assertEqualHoverAnalysis(
    expected: string | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const actual: Hover | undefined = await TestUtils.assertHoverAnalysis(settings, textWithPipe, cancellationToken);

    if (expected) {
        Assert.isDefined(actual);
        expect(assertAsMarkupContent(actual.contents).value).to.equal(expected);
    } else {
        Assert.isUndefined(actual);
    }
}

export async function assertEqualNodeScope(
    expected: ReadonlyArray<TAbridgedNodeScopeItem>,
    settings: Settings,
    textWithPipe: string,
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
        settings,
        text,
    );

    if (expected) {
        Assert.isDefined(semanticTokens);
        expect(semanticTokens).to.deep.equal(expected);
    } else {
        Assert.isUndefined(semanticTokens);
    }
}

export async function assertEqualRenameEdits(
    expected: TextEdit[] | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
    newName: string,
    cancellationToken?: ICancellationToken,
): Promise<void> {
    const textEdits: TextEdit[] | undefined = await TestUtils.assertRenameEdits(
        settings,
        textWithPipe,
        newName,
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
    expected: TPowerQueryType,
    settings: InspectionSettings,
    text: string,
): Promise<void> {
    const actual: TPowerQueryType = await TestUtils.assertRootType(settings, text);
    expect(actual).to.deep.equal(expected);
}

export async function assertEqualSignatureHelpAnalysis(
    expected: SignatureHelp | undefined,
    settings: AnalysisSettings,
    textWithPipe: string,
): Promise<void> {
    const signatureHelp: SignatureHelp | undefined = await TestUtils.assertSignatureHelpAnalysis(
        settings,
        textWithPipe,
    );

    if (expected) {
        Assert.isDefined(signatureHelp);
        expect(signatureHelp).to.deep.equal(expected);
    } else {
        Assert.isUndefined(signatureHelp);
    }
}

export async function assertEqualScopeType(
    expected: Inspection.ScopeTypeByKey,
    settings: InspectionSettings,
    textWithPipe: string,
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
