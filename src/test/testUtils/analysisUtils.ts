// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, ICancellationToken } from "@microsoft/powerquery-parser";
import { DocumentSymbol, FoldingRange, Hover, Location, Position, SignatureHelp } from "vscode-languageserver-types";

import * as TestUtils from "./testUtils";
import { Analysis, AnalysisSettings, AnalysisUtils, PartialSemanticToken } from "../../powerquery-language-services";
import { AutocompleteItem } from "../../powerquery-language-services/inspection";
import { MockDocument } from "../mockDocument";
import { TextEdit } from "vscode-languageserver-textdocument";

export function assertAnalysisFromText(analysisSettings: AnalysisSettings, text: string): Analysis {
    const document: MockDocument = TestUtils.mockDocument(text);

    return AnalysisUtils.createAnalysis(document, analysisSettings);
}

export function assertAnalysisAndPositionFromText(
    textWithPipe: string,
    analysisSettings: AnalysisSettings,
): [Analysis, Position] {
    const [document, position]: [MockDocument, Position] = createMockDocumentAndPosition(textWithPipe);

    const analysis: Analysis = AnalysisUtils.createAnalysis(document, analysisSettings);

    return [analysis, position];
}

export async function assertAutocompleteAnalysis(
    textWithPipe: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<AutocompleteItem[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(textWithPipe, settings);

    return Assert.unboxOk(await analysis.getAutocompleteItems(position, cancellationToken));
}

export async function assertDefinitionAnalysis(
    textWithPipe: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<Location[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(textWithPipe, settings);

    return Assert.unboxOk(await analysis.getDefinition(position, cancellationToken));
}

export async function assertDocumentSymbolsAnalysis(
    textWithPipe: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<DocumentSymbol[] | undefined> {
    const analysis: Analysis = assertAnalysisFromText(settings, textWithPipe);

    return Assert.unboxOk(await analysis.getDocumentSymbols(cancellationToken));
}

export async function assertFoldingRangesAnalysis(
    text: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<FoldingRange[] | undefined> {
    const analysis: Analysis = assertAnalysisFromText(settings, text);

    return Assert.unboxOk(await analysis.getFoldingRanges(cancellationToken));
}

export async function assertHoverAnalysis(
    textWithPipe: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<Hover | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(textWithPipe, settings);

    return Assert.unboxOk(await analysis.getHover(position, cancellationToken));
}

export async function assertPartialSemanticTokens(
    text: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<PartialSemanticToken[] | undefined> {
    const analysis: Analysis = assertAnalysisFromText(settings, text);

    return Assert.unboxOk(await analysis.getPartialSemanticTokens(cancellationToken));
}

export async function assertRenameEdits(
    textWithPipe: string,
    newName: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<TextEdit[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(textWithPipe, settings);

    return Assert.unboxOk(await analysis.getRenameEdits(position, newName, cancellationToken));
}

export async function assertSignatureHelpAnalysis(
    textWithPipe: string,
    settings: AnalysisSettings,
    cancellationToken?: ICancellationToken,
): Promise<SignatureHelp | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(textWithPipe, settings);

    return Assert.unboxOk(await analysis.getSignatureHelp(position, cancellationToken));
}

function createMockDocumentAndPosition(textWithPipe: string): [MockDocument, Position] {
    const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);
    const document: MockDocument = TestUtils.mockDocument(text);

    return [document, position];
}
