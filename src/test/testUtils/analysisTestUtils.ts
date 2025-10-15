// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    type DocumentSymbol,
    type FoldingRange,
    type Hover,
    type Location,
    type Position,
    type SignatureHelp,
} from "vscode-languageserver-types";
import { type ICancellationToken, ResultUtils } from "@microsoft/powerquery-parser";

import * as TestUtils from "./testUtils";
import {
    type Analysis,
    type AnalysisSettings,
    AnalysisUtils,
    type PartialSemanticToken,
} from "../../powerquery-language-services";
import { type AutocompleteItem } from "../../powerquery-language-services/inspection";
import { type MockDocument } from "../mockDocument";
import { type TextEdit } from "vscode-languageserver-textdocument";

export function assertAnalysisFromText(params: {
    readonly text: string;
    readonly analysisSettings: AnalysisSettings;
}): Analysis {
    const document: MockDocument = TestUtils.mockDocument(params.text);

    return AnalysisUtils.analysis(document, params.analysisSettings);
}

export function assertAnalysisAndPositionFromText(params: {
    readonly textWithPipe: string;
    readonly analysisSettings: AnalysisSettings;
}): [Analysis, Position] {
    const [document, position]: [MockDocument, Position] = createMockDocumentAndPosition(params.textWithPipe);

    const analysis: Analysis = AnalysisUtils.analysis(document, params.analysisSettings);

    return [analysis, position];
}

export async function assertAutocompleteAnalysis(params: {
    readonly textWithPipe: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<AutocompleteItem[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(params);

    return ResultUtils.assertOk(await analysis.getAutocompleteItems(position, params.cancellationToken));
}

export async function assertDefinitionAnalysis(params: {
    readonly textWithPipe: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<Location[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(params);

    return ResultUtils.assertOk(await analysis.getDefinition(position, params.cancellationToken));
}

export async function assertDocumentSymbolsAnalysis(params: {
    readonly text: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<DocumentSymbol[] | undefined> {
    const analysis: Analysis = assertAnalysisFromText(params);

    return ResultUtils.assertOk(await analysis.getDocumentSymbols(params.cancellationToken));
}

export async function assertFoldingRangesAnalysis(params: {
    readonly text: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<FoldingRange[] | undefined> {
    const analysis: Analysis = assertAnalysisFromText(params);

    return ResultUtils.assertOk(await analysis.getFoldingRanges(params.cancellationToken));
}

export async function assertHoverAnalysis(params: {
    readonly textWithPipe: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<Hover | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(params);

    return ResultUtils.assertOk(await analysis.getHover(position, params.cancellationToken));
}

export async function assertPartialSemanticTokens(params: {
    readonly text: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<PartialSemanticToken[] | undefined> {
    const analysis: Analysis = assertAnalysisFromText(params);

    return ResultUtils.assertOk(await analysis.getPartialSemanticTokens(params.cancellationToken));
}

export async function assertRenameEdits(params: {
    readonly textWithPipe: string;
    readonly newName: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<TextEdit[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(params);

    return ResultUtils.assertOk(await analysis.getRenameEdits(position, params.newName, params.cancellationToken));
}

export async function assertSignatureHelpAnalysis(params: {
    readonly textWithPipe: string;
    readonly analysisSettings: AnalysisSettings;
    readonly cancellationToken?: ICancellationToken;
}): Promise<SignatureHelp | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(params);

    return ResultUtils.assertOk(await analysis.getSignatureHelp(position, params.cancellationToken));
}

function createMockDocumentAndPosition(textWithPipe: string): [MockDocument, Position] {
    const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);
    const document: MockDocument = TestUtils.mockDocument(text);

    return [document, position];
}
