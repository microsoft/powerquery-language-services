// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DocumentSymbol, FoldingRange, Hover, Location, Position, SignatureHelp } from "vscode-languageserver-types";
import { ICancellationToken, ResultUtils } from "@microsoft/powerquery-parser";

import * as TestUtils from "./testUtils";
import { Analysis, AnalysisSettings, AnalysisUtils, PartialSemanticToken } from "../../powerquery-language-services";
import { assertEqualAbridgedAutocompleteItems } from "./assertEqualTestUtils";
import { AutocompleteItem } from "../../powerquery-language-services/inspection";
import { MockDocument } from "../mockDocument";
import { TextEdit } from "vscode-languageserver-textdocument";

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
    readonly expected?: {
        readonly labels: ReadonlyArray<string>;
        readonly isTextEdit: boolean;
        readonly mode?: TestUtils.ExpectCollectionMode;
    };
}): Promise<AutocompleteItem[] | undefined> {
    const [analysis, position]: [Analysis, Position] = assertAnalysisAndPositionFromText(params);

    const result: AutocompleteItem[] | undefined = ResultUtils.assertOk(
        await analysis.getAutocompleteItems(position, params.cancellationToken),
    );

    if (params.expected !== undefined) {
        assertEqualAbridgedAutocompleteItems({
            actual: result ?? [],
            expected: params.expected,
        });
    }

    return result;
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
