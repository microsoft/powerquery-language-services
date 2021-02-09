// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as File from "fs";
import * as Path from "path";
import * as TestConstants from "./testConstants";
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

import * as AnalysisUtils from "../powerquery-language-services/analysis/analysisUtils";
import * as WorkspaceCache from "../powerquery-language-services/workspaceCache";

import {
    Analysis,
    CompletionItemProviderContext,
    DocumentSymbol,
    HoverProviderContext,
    Library,
    NullLibraryProvider,
    SignatureProviderContext,
    SymbolKind,
} from "../powerquery-language-services";
import { AnalysisOptions } from "../powerquery-language-services/analysis/analysisOptions";
import { MockDocument } from "./mockDocument";
import { LibraryCompletionItemProvider } from "../powerquery-language-services/providers/libraryCompletionItemProviderr";

export const EmptyCompletionItems: ReadonlyArray<CompletionItem> = [];

// export const EmptyHover: Hover = {
//     range: undefined,
//     contents: [],
// };

// export const EmptySignatureHelp: SignatureHelp = {
//     signatures: [],
//     // tslint:disable-next-line: no-null-keyword
//     activeParameter: null,
//     activeSignature: 0,
// };

// class ErrorLibraryProvider extends NullLibraryProvider {
//     public async getCompletionItems(_context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
//         throw new Error("error provider always errors");
//     }
// }

// export class SimpleLibraryProvider implements LibraryProvider {
//     public readonly externalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn =
//         PQP.Language.ExternalType.noOpExternalTypeResolver;
//     public readonly libraryDefinitions: Library.LibraryDefinitions = new Map();

//     constructor(private readonly members: ReadonlyArray<string>) {
//         this.members = members;
//     }

//     public async getCompletionItems(_context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
//         return this.members.map((member: string) => {
//             return {
//                 kind: CompletionItemKind.Function,
//                 label: member,
//             };
//         });
//     }

//     public async getHover(context: HoverProviderContext): Promise<Hover | null> {
//         const member: string | undefined = this.getMember(context.identifier);
//         if (member) {
//             return {
//                 contents: `member named '${member}`,
//                 range: context.range,
//             };
//         }

//         // tslint:disable-next-line: no-null-keyword
//         return null;
//     }

//     public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
//         const member: string | undefined = this.getMember(context.functionName);
//         if (member) {
//             return {
//                 signatures: [
//                     {
//                         label: member,
//                         parameters: [],
//                     },
//                 ],
//                 // tslint:disable-next-line: no-null-keyword
//                 activeParameter: context.argumentOrdinal ? context.argumentOrdinal : null,
//                 activeSignature: 0,
//             };
//         }

//         // tslint:disable-next-line: no-null-keyword
//         return null;
//     }

//     public includeModules(_modules: ReadonlyArray<string>): void {
//         throw new Error("Method not implemented.");
//     }

//     private getMember(value: string | undefined): string | undefined {
//         if (value === undefined) {
//             return undefined;
//         }

//         return this.members.find((member: string) => {
//             return value === member;
//         });
//     }
// }

// export const ErrorAnalysisOptions: AnalysisOptions = {
//     libraryProvider: new ErrorLibraryProvider(),
// };

export function documentFromFile(fileName: string): MockDocument {
    return new MockDocument(readFile(fileName), "powerquery");
}

export function documentFromText(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

export function documentAndPositionFrom(text: string): [MockDocument, Position] {
    validateTextWithMarker(text);
    const document: MockDocument = documentFromText(text.replace("|", ""));
    const position: Position = document.positionAt(text.indexOf("|"));

    return [document, position];
}

export function readFile(fileName: string): string {
    const fullPath: string = Path.join(Path.dirname(__filename), "files", fileName);
    assert.isTrue(File.existsSync(fullPath), `file ${fullPath} not found.`);
    return File.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
}

// export function assertIsDefined<T>(maybeValue: T | undefined): asserts maybeValue is NonNullable<T> {
//     if (maybeValue === undefined) {
//         throw new Error(`assert failed, expected value to be defined`);
//     }
// }

// function assertIsCacheItemStageEqual<T, Stage>(
//     cacheItem: WorkspaceCache.TCacheItem,
//     expectedStage: WorkspaceCache.CacheStageKind,
// ): asserts cacheItem is WorkspaceCache.TCacheItem & WorkspaceCache.CacheItemOk<T, Stage> {
//     if (cacheItem.stage !== expectedStage) {
//         throw assert.fail(`cacheItem.stage !== expectedStage`);
//     }
// }

// function assertCacheItemOk<T, Stage>(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.CacheItemOk<T, Stage> & WorkspaceCache.TCacheItem {
//     if (cacheItem.kind !== PQP.ResultKind.Ok) {
//         throw assert.fail(`cacheItem was expected to be an Ok`);
//     }
// }

// export function assertCacheItemErr<E, Stage>(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.CacheItemErr<E, Stage> & WorkspaceCache.TCacheItem {
//     if (cacheItem.kind !== PQP.ResultKind.Err) {
//         throw assert.fail(`cacheItem was expected to be an Err`);
//     }
// }

// export function assertLexerCacheItemOk(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.LexerCacheItem &
//     WorkspaceCache.CacheItemOk<PQP.Lexer.State, WorkspaceCache.CacheStageKind.Lexer> {
//     assertCacheItemOk(cacheItem);
//     assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Lexer);
// }

// export function assertLexerSnapshotCacheItemOk(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.LexerSnapshotCacheItem &
//     WorkspaceCache.CacheItemOk<PQP.Lexer.LexerSnapshot, WorkspaceCache.CacheStageKind.LexerSnapshot> {
//     assertCacheItemOk(cacheItem);
//     assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.LexerSnapshot);
// }

// export function assertParserCacheItemOk(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.ParserCacheItem &
//     WorkspaceCache.CacheItemOk<PQP.Parser.ParseOk, WorkspaceCache.CacheStageKind.Parser> {
//     assertCacheItemOk(cacheItem);
//     assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Parser);
// }

// export function assertParserCacheItemErr(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.ParserCacheItem &
//     WorkspaceCache.CacheItemErr<PQP.Parser.ParseError.TParseError, WorkspaceCache.CacheStageKind.Parser> {
//     assertCacheItemErr(cacheItem);
//     assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Parser);
// }

// export function assertInspectionCacheItemOk(
//     cacheItem: WorkspaceCache.TCacheItem,
// ): asserts cacheItem is WorkspaceCache.InspectionCacheItem &
//     WorkspaceCache.CacheItemOk<PQP.Inspection.Inspection, WorkspaceCache.CacheStageKind.Inspection> {
//     assertCacheItemOk(cacheItem);
//     assertIsCacheItemStageEqual(cacheItem, WorkspaceCache.CacheStageKind.Inspection);
// }

// export function assertGetInspectionCacheItemOk(document: MockDocument, position: Position): PQP.Inspection.Inspection {
//     const cacheItem: WorkspaceCache.TInspectionCacheItem | undefined = WorkspaceCache.getTriedInspection(
//         document,
//         position,
//         undefined,
//         undefined,
//     );
//     assertIsDefined(cacheItem);
//     assertInspectionCacheItemOk(cacheItem);
//     return cacheItem.value;
// }

// export async function getCompletionItems(
//     text: string,
//     maybeAnalysisOptions?: AnalysisOptions,
// ): Promise<ReadonlyArray<CompletionItem>> {
//     return createAnalysis(text, analysisOptions).getCompletionItems();
// }

// export async function getCompletionItemsForFile(
//     fileName: string,
//     position: Position,
//     maybeAnalysisOptions?: AnalysisOptions,
// ): Promise<ReadonlyArray<CompletionItem>> {
//     return createFileAnalysis(fileName, position, analysisOptions).getCompletionItems();
// }

export async function getHover(text: string, maybeAnalysisOptions?: AnalysisOptions): Promise<Hover> {
    return createAnalysis(text, maybeAnalysisOptions).getHover();
}

// export async function getSignatureHelp(text: string, maybeAnalysisOptions?: AnalysisOptions): Promise<SignatureHelp> {
//     return createAnalysis(text, analysisOptions).getSignatureHelp();
// }

// // Adapted from vscode-languageserver-code implementation

// export function validateError(diagnostic: Diagnostic, startPosition: Position): void {
//     assert.isDefined(diagnostic.code);
//     assert.isDefined(diagnostic.message);
//     assert.isDefined(diagnostic.range);
//     expect(diagnostic.range.start).to.deep.equal(startPosition);
//     expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
// }

// export function containsCompletionItem(completionItems: ReadonlyArray<CompletionItem>, label: string): void {
//     for (const item of completionItems) {
//         if (item.label === label) {
//             return;
//         }
//     }

//     assert.fail(`completion item '${label}' not found in array. Items: ${JSON.stringify(completionItems)}`);
// }

// export function containsCompletionItemLabels(
//     actualCompletionItems: ReadonlyArray<CompletionItem>,
//     expectedLabels: ReadonlyArray<string>,
// ): void {
//     const actualCompletionItemLabels: ReadonlyArray<string> = actualCompletionItems.map(value => {
//         return value.label;
//     });

//     expect(actualCompletionItemLabels).to.include.members(expectedLabels);
// }

// export function equalsCompletionItemLabels(
//     completionItems: ReadonlyArray<CompletionItem>,
//     labels: ReadonlyArray<string>,
// ): void {
//     const actualCompletionItemLabels: ReadonlyArray<string> = completionItems
//         .map((value: CompletionItem) => value.label)
//         .sort();
//     expect(actualCompletionItemLabels.length).equals(labels.length);
//     expect(actualCompletionItemLabels).contains.members(labels);
// }

// export function dumpNodeToTraceFile(node: PQP.Language.Ast.INode, filePath: string): void {
//     const asJson: string = JSON.stringify(node);
//     File.writeFileSync(filePath, asJson);
// }

// export interface ExpectedDocumentSymbol {
//     name: string;
//     kind: SymbolKind;
//     maybeChildren?: ReadonlyArray<ExpectedDocumentSymbol>;
// }

// export function documentSymbolArrayToExpectedSymbols(
//     documentSymbols: ReadonlyArray<DocumentSymbol>,
// ): ReadonlyArray<ExpectedDocumentSymbol> {
//     return documentSymbols.map((documentSymbol: DocumentSymbol) => {
//         if (documentSymbol.children !== undefined && documentSymbol.children.length > 0) {
//             return {
//                 name: documentSymbol.name,
//                 kind: documentSymbol.kind,
//                 maybeChildren: documentSymbolArrayToExpectedSymbols(documentSymbol.children),
//             };
//         } else {
//             return {
//                 name: documentSymbol.name,
//                 kind: documentSymbol.kind,
//             };
//         }
//     });
// }

function createAnalysis(text: string, maybeAnalysisOptions?: AnalysisOptions): Analysis {
    const [document, position]: [MockDocument, Position] = documentAndPositionFrom(text);
    return AnalysisUtils.createAnalysis(document, position, createAnalysisOptions(maybeAnalysisOptions));
}

function createFileAnalysis(fileName: string, position: Position, maybeAnalysisOptions?: AnalysisOptions): Analysis {
    const document: MockDocument = documentFromText(readFile(fileName));
    return AnalysisUtils.createAnalysis(document, position, createAnalysisOptions(maybeAnalysisOptions));
}

function createAnalysisOptions(maybeAnalysisOptions?: AnalysisOptions): AnalysisOptions {
    return {
        libraryCompletionItemProvider:
            maybeAnalysisOptions?.libraryCompletionItemProvider ?? TestConstants.SimpleLibraryCompletionItemProvider,
    };
}

function validateTextWithMarker(text: string): void {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");
}
