// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as PQP from "@microsoft/powerquery-parser";
import * as File from "fs";
import * as Path from "path";

import { assert, expect } from "chai";
import { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import {
    CompletionItem,
    CompletionItemKind,
    Diagnostic,
    DiagnosticSeverity,
    Hover,
    Position,
    Range,
    SignatureHelp,
} from "vscode-languageserver-types";

import * as AnalysisUtils from "../../powerquery-language-services/analysis/analysisUtils";
import * as WorkspaceCache from "../../powerquery-language-services/workspaceCache";

import {
    Analysis,
    CompletionItemProviderContext,
    DocumentSymbol,
    HoverProviderContext,
    LibrarySymbolProvider,
    NullLibrarySymbolProvider,
    SignatureProviderContext,
    SymbolKind,
} from "../../powerquery-language-services";
import { AnalysisOptions } from "../../powerquery-language-services/analysis/analysisOptions";

class ErrorLibraryProvider extends NullLibrarySymbolProvider {
    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        throw new Error("error provider always errors");
    }
}

export class SimpleLibraryProvider implements LibrarySymbolProvider {
    private readonly members: string[];

    constructor(members: string[]) {
        this.members = members;
    }

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        const result: CompletionItem[] = [];
        this.members.forEach(member => {
            result.push({
                kind: CompletionItemKind.Function,
                label: member,
            });
        });

        return result;
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        const member: string | undefined = this.getMember(context.identifier);
        if (member) {
            return {
                contents: `member named '${member}`,
                range: context.range,
            };
        }

        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        const member: string | undefined = this.getMember(context.functionName);
        if (member) {
            return {
                signatures: [
                    {
                        label: member,
                        parameters: [],
                    },
                ],
                // tslint:disable-next-line: no-null-keyword
                activeParameter: context.argumentOrdinal ? context.argumentOrdinal : null,
                activeSignature: 0,
            };
        }

        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public includeModules(_modules: string[]): void {
        throw new Error("Method not implemented.");
    }

    private getMember(value: string | undefined): string | undefined {
        if (value === undefined) {
            return undefined;
        }

        return this.members.find((member: string) => {
            return value === member;
        });
    }
}

export const errorAnalysisOptions: AnalysisOptions = {
    librarySymbolProvider: new ErrorLibraryProvider(),
};

export function documentFromText(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

export function documentFromFile(fileName: string): MockDocument {
    return new MockDocument(readFile(fileName), "powerquery");
}

export function readFile(fileName: string): string {
    const fullPath: string = Path.join(Path.dirname(__filename), "files", fileName);
    assert.isTrue(File.existsSync(fullPath), `file ${fullPath} not found.`);
    return File.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
}

export function documentAndPositionFrom(text: string): [MockDocument, Position] {
    validateTextWithMarker(text);
    const document: MockDocument = documentFromText(text.replace("|", ""));
    const position: Position = document.positionAt(text.indexOf("|"));

    return [document, position];
}

export function assertIsDefined<T>(maybeValue: T | undefined): asserts maybeValue is NonNullable<T> {
    if (maybeValue === undefined) {
        throw new Error(`assert failed, expected value to be defined`);
    }
}

function assertIsCacheItemStageEqual<T, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
    expectedStage: WorkspaceCache.CacheStageKind,
): asserts cacheItem is WorkspaceCache.TCacheItem & WorkspaceCache.CacheItemOk<T, Stage> {
    if (cacheItem.stage !== expectedStage) {
        throw assert.fail(`cacheItem.stage !== expectedStage`);
    }
}

function assertCacheItemOk<T, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.CacheItemOk<T, Stage> & WorkspaceCache.TCacheItem {
    if (cacheItem.kind !== PQP.ResultKind.Ok) {
        throw assert.fail(`cacheItem was expected to be an Ok`);
    }
}

export function assertCacheItemErr<E, Stage>(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.CacheItemErr<E, Stage> & WorkspaceCache.TCacheItem {
    if (cacheItem.kind !== PQP.ResultKind.Err) {
        throw assert.fail(`cacheItem was expected to be an Err`);
    }
}

export function assertLexerCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.LexerCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Lexer.State, WorkspaceCache.CacheStageKind.Lexer> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Lexer);
}

export function assertLexerSnapshotCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.LexerSnapshotCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Lexer.LexerSnapshot, WorkspaceCache.CacheStageKind.LexerSnapshot> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.LexerSnapshot);
}

export function assertParserCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.ParserCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Parser.ParseOk, WorkspaceCache.CacheStageKind.Parser> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Parser);
}

export function assertParserCacheItemErr(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.ParserCacheItem &
    WorkspaceCache.CacheItemErr<PQP.Parser.ParseError.TParseError, WorkspaceCache.CacheStageKind.Parser> {
    assertCacheItemErr(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Parser);
}

export function assertInspectionCacheItemOk(
    cacheItem: WorkspaceCache.TCacheItem,
): asserts cacheItem is WorkspaceCache.InspectionCacheItem &
    WorkspaceCache.CacheItemOk<PQP.Inspection.Inspection, WorkspaceCache.CacheStageKind.Inspection> {
    assertCacheItemOk(cacheItem);
    assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Inspection);
}

export function assertGetInspectionCacheItemOk(document: MockDocument, position: Position): PQP.Inspection.Inspection {
    const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCache.getTriedInspection(
        document,
        position,
        undefined,
    );
    assertIsDefined(cacheItem);
    assertInspectionCacheItemOk(cacheItem);
    return cacheItem.value;
}

export async function getCompletionItems(text: string, analysisOptions?: AnalysisOptions): Promise<CompletionItem[]> {
    return createAnalysis(text, analysisOptions).getCompletionItems();
}

export async function getCompletionItemsForFile(
    fileName: string,
    position: Position,
    analysisOptions?: AnalysisOptions,
): Promise<CompletionItem[]> {
    return createFileAnalysis(fileName, position, analysisOptions).getCompletionItems();
}

export async function getHover(text: string, analysisOptions?: AnalysisOptions): Promise<Hover> {
    return createAnalysis(text, analysisOptions).getHover();
}

export async function getSignatureHelp(text: string, analysisOptions?: AnalysisOptions): Promise<SignatureHelp> {
    return createAnalysis(text, analysisOptions).getSignatureHelp();
}

// Adapted from vscode-languageserver-code implementation
export class MockDocument implements TextDocument {
    private static NextUri: number = 0;

    private readonly _uri: string;
    private readonly _languageId: string;

    private _content: string;
    private _lineOffsets: number[] | undefined;
    private _version: number;

    constructor(content: string, languageId: string) {
        this._content = content;
        this._languageId = languageId;
        this._uri = MockDocument.getNextUri();
        this._version = 0;
    }

    public get uri(): string {
        return this._uri;
    }

    public get languageId(): string {
        return this._languageId;
    }

    public get version(): number {
        return this._version;
    }

    public getText(range?: Range): string {
        if (range) {
            const start: number = this.offsetAt(range.start);
            const end: number = this.offsetAt(range.end);
            return this._content.substring(start, end);
        }
        return this._content;
    }

    public setText(text: string): void {
        this._content = text;
        this._lineOffsets = undefined;
        this._version += 1;
    }

    public offsetAt(position: Position): number {
        const lineOffsets: number[] = this.getLineOffsets();
        if (position.line >= lineOffsets.length) {
            return this._content.length;
        } else if (position.line < 0) {
            return 0;
        }
        const lineOffset: number = lineOffsets[position.line];
        const nextLineOffset: number =
            position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
        return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
    }

    public positionAt(offset: number): Position {
        offset = Math.max(Math.min(offset, this._content.length), 0);

        const lineOffsets: number[] = this.getLineOffsets();
        let low: number = 0;
        let high: number = lineOffsets.length;
        if (high === 0) {
            return Position.create(0, offset);
        }
        while (low < high) {
            const mid: number = Math.floor((low + high) / 2);
            if (lineOffsets[mid] > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        // low is the least x for which the line offset is larger than the current offset
        // or array.length if no line offset is larger than the current offset
        const line: number = low - 1;
        return Position.create(line, offset - lineOffsets[line]);
    }

    // Helper function
    public update(text: string): TextDocumentContentChangeEvent[] {
        this.setText(text);
        return [{ text }];
    }

    public get lineCount(): number {
        return this.getLineOffsets().length;
    }

    private static getNextUri(): string {
        MockDocument.NextUri += 1;
        return MockDocument.NextUri.toString();
    }

    private getLineOffsets(): number[] {
        if (this._lineOffsets === undefined) {
            const lineOffsets: number[] = [];
            const text: string = this._content;
            let isLineStart: boolean = true;
            for (let i: number = 0; i < text.length; i += 1) {
                if (isLineStart) {
                    lineOffsets.push(i);
                    isLineStart = false;
                }
                const ch: string = text.charAt(i);
                isLineStart = ch === "\r" || ch === "\n";
                if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === "\n") {
                    i += 1;
                }
            }
            if (isLineStart && text.length > 0) {
                lineOffsets.push(text.length);
            }
            this._lineOffsets = lineOffsets;
        }
        return this._lineOffsets;
    }
}

export function validateError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

export function containsCompletionItem(completionItems: CompletionItem[], label: string): void {
    for (const item of completionItems) {
        if (item.label === label) {
            return;
        }
    }

    assert.fail(`completion item '${label}' not found in array. Items: ${JSON.stringify(completionItems)}`);
}

export function containsCompletionItemLabels(actualCompletionItems: CompletionItem[], expectedLabels: string[]): void {
    const actualCompletionItemLabels: string[] = actualCompletionItems.map(value => {
        return value.label;
    });

    expect(actualCompletionItemLabels).to.include.members(expectedLabels);
}

export function equalsCompletionItemLabels(completionItems: CompletionItem[], labels: string[]): void {
    const actualCompletionItemLabels: ReadonlyArray<string> = completionItems.map(value => value.label).sort();
    const sortedExpectedLabels: ReadonlyArray<string> = labels.sort();

    expect(actualCompletionItemLabels).deep.equals(sortedExpectedLabels);
}

export const emptyCompletionItems: CompletionItem[] = [];

export const emptyHover: Hover = {
    range: undefined,
    contents: [],
};

export const emptySignatureHelp: SignatureHelp = {
    signatures: [],
    // tslint:disable-next-line: no-null-keyword
    activeParameter: null,
    activeSignature: 0,
};

export function dumpNodeToTraceFile(node: PQP.Language.Ast.INode, filePath: string): void {
    const asJson: string = JSON.stringify(node);
    File.writeFileSync(filePath, asJson);
}

export interface ExpectedDocumentSymbol {
    name: string;
    kind: SymbolKind;
    children?: ExpectedDocumentSymbol[];
}

export function documentSymbolArrayToExpectedSymbols(documentSymbols: DocumentSymbol[]): ExpectedDocumentSymbol[] {
    const expectedSymbols: ExpectedDocumentSymbol[] = [];
    documentSymbols.forEach(element => {
        let children: ExpectedDocumentSymbol[] | undefined;
        if (element.children) {
            children = documentSymbolArrayToExpectedSymbols(element.children);
            expectedSymbols.push({ name: element.name, kind: element.kind, children });
        } else {
            expectedSymbols.push({ name: element.name, kind: element.kind });
        }
    });
    return expectedSymbols;
}

const DefaultAnalysisOptions: AnalysisOptions = {};

function createAnalysis(text: string, analysisOptions?: AnalysisOptions): Analysis {
    const [document, position]: [MockDocument, Position] = documentAndPositionFrom(text);
    return AnalysisUtils.createAnalysis(document, position, analysisOptions ?? DefaultAnalysisOptions);
}

function createFileAnalysis(fileName: string, position: Position, analysisOptions?: AnalysisOptions): Analysis {
    const document: MockDocument = documentFromText(readFile(fileName));
    return AnalysisUtils.createAnalysis(document, position, analysisOptions ?? DefaultAnalysisOptions);
}

function validateTextWithMarker(text: string): void {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");
}
