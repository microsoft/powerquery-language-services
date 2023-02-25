// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as File from "fs";
import * as Path from "path";
import { assert, expect } from "chai";
import { CommonError, ICancellationToken, Result } from "@microsoft/powerquery-parser";
import {
    DocumentSymbol,
    FoldingRange,
    Hover,
    Location,
    Position,
    SignatureHelp,
    SymbolKind,
} from "vscode-languageserver-types";

import * as AnalysisUtils from "../../powerquery-language-services/analysis/analysisUtils";
import * as TestConstants from "../testConstants";
import { Analysis, Inspection, PartialSemanticToken } from "../../powerquery-language-services";
import { AnalysisSettings } from "../..";
import { MockDocument } from "../mockDocument";

export interface AbridgedDocumentSymbol {
    readonly name: string;
    readonly kind: SymbolKind;
    readonly children?: ReadonlyArray<AbridgedDocumentSymbol>;
}

export type AbridgedSignatureHelp = Pick<SignatureHelp, "activeSignature" | "activeParameter">;

export function createFileMockDocument(fileName: string): MockDocument {
    return new MockDocument(readFile(fileName), "powerquery");
}

export function createTextMockDocument(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

export function createMockDocumentAndPosition(text: string): [MockDocument, Position] {
    validateTextWithMarker(text);
    const document: MockDocument = createTextMockDocument(text.replace("|", ""));
    const position: Position = document.positionAt(text.indexOf("|"));

    return [document, position];
}

export function readFile(fileName: string): string {
    const fullPath: string = Path.join(Path.dirname(__filename), "..", "files", fileName);
    assert.isTrue(File.existsSync(fullPath), `file ${fullPath} not found.`);

    return File.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
}

export function createAbridgedDocumentSymbols(
    documentSymbols: ReadonlyArray<DocumentSymbol>,
): ReadonlyArray<AbridgedDocumentSymbol> {
    return documentSymbols.map((documentSymbol: DocumentSymbol) => {
        if (documentSymbol.children !== undefined && documentSymbol.children.length > 0) {
            return {
                name: documentSymbol.name,
                kind: documentSymbol.kind,
                children: createAbridgedDocumentSymbols(documentSymbol.children),
            };
        } else {
            return {
                name: documentSymbol.name,
                kind: documentSymbol.kind,
            };
        }
    });
}

export function createAbridgedSignatureHelp(value: SignatureHelp): AbridgedSignatureHelp {
    return {
        activeParameter: value.activeParameter,
        activeSignature: value.activeSignature,
    };
}

export function createAnalysisAndExtractPosition(
    textWithPipe: string,
    analysisSettings?: AnalysisSettings,
): [Analysis, Position] {
    const [document, position]: [MockDocument, Position] = createMockDocumentAndPosition(textWithPipe);

    return [AnalysisUtils.createAnalysis(document, createAnalysisSettings(analysisSettings)), position];
}

export function createAutocompleteItems(
    textWithPipe: string,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
    const [analysis, position]: [Analysis, Position] = createAnalysisAndExtractPosition(textWithPipe, analysisSettings);

    return analysis.getAutocompleteItems(position, cancellationToken);
}

export function createAutocompleteItemsForFile(
    fileName: string,
    position: Position,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
    return createFileAnalysis(fileName, analysisSettings).getAutocompleteItems(position, cancellationToken);
}

export function createDefinition(
    textWithPipe: string,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
    const [analysis, position]: [Analysis, Position] = createAnalysisAndExtractPosition(textWithPipe, analysisSettings);

    return analysis.getDefinition(position, cancellationToken);
}

export function createFoldingRanges(
    text: string,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>> {
    const analysis: Analysis = AnalysisUtils.createAnalysis(
        createTextMockDocument(text),
        createAnalysisSettings(analysisSettings),
    );

    return analysis.getFoldingRanges(cancellationToken);
}

export function createHover(
    text: string,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<Hover | undefined, CommonError.CommonError>> {
    const [analysis, position]: [Analysis, Position] = createAnalysisAndExtractPosition(text, analysisSettings);

    return analysis.getHover(position, cancellationToken);
}

export function createPartialSemanticTokens(
    textWithPosition: string,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
    const analysis: Analysis = AnalysisUtils.createAnalysis(
        createTextMockDocument(textWithPosition),
        createAnalysisSettings(analysisSettings),
    );

    return analysis.getPartialSemanticTokens(cancellationToken);
}

export function createSignatureHelp(
    textWithPipe: string,
    analysisSettings?: AnalysisSettings,
    cancellationToken: ICancellationToken = TestConstants.NoOpCancellationTokenInstance,
): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
    const [analysis, position]: [Analysis, Position] = createAnalysisAndExtractPosition(textWithPipe, analysisSettings);

    return analysis.getSignatureHelp(position, cancellationToken);
}

function createFileAnalysis(fileName: string, analysisSettings?: AnalysisSettings): Analysis {
    const document: MockDocument = createTextMockDocument(readFile(fileName));

    return AnalysisUtils.createAnalysis(document, createAnalysisSettings(analysisSettings));
}

function createAnalysisSettings(analysisSettings?: AnalysisSettings): AnalysisSettings {
    return {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        ...(analysisSettings ?? {}),
    };
}

function validateTextWithMarker(text: string): void {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");
}
