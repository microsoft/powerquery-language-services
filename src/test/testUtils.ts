// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, expect } from "chai";
import * as File from "fs";
import * as Path from "path";
import {
    CompletionItem,
    Diagnostic,
    DiagnosticSeverity,
    DocumentSymbol,
    Hover,
    MarkupContent,
    Position,
    SignatureHelp,
    SymbolKind,
} from "vscode-languageserver-types";

import * as AnalysisUtils from "../powerquery-language-services/analysis/analysisUtils";

import { Assert } from "@microsoft/powerquery-parser";
import { Analysis } from "../powerquery-language-services";
import { AnalysisOptions } from "../powerquery-language-services/analysis/analysisOptions";
import { ILibrary } from "../powerquery-language-services/library/library";
import { MockDocument } from "./mockDocument";
import * as TestConstants from "./testConstants";

export interface AbridgedDocumentSymbol {
    readonly name: string;
    readonly kind: SymbolKind;
    readonly maybeChildren?: ReadonlyArray<AbridgedDocumentSymbol>;
}

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

export function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);
    return value;
}

export function assertIsDefined<T>(maybeValue: T | undefined): asserts maybeValue is NonNullable<T> {
    Assert.isDefined(maybeValue);
}

export function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

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

export function createAbridgedDocumentSymbols(
    documentSymbols: ReadonlyArray<DocumentSymbol>,
): ReadonlyArray<AbridgedDocumentSymbol> {
    return documentSymbols.map((documentSymbol: DocumentSymbol) => {
        if (documentSymbol.children !== undefined && documentSymbol.children.length > 0) {
            return {
                name: documentSymbol.name,
                kind: documentSymbol.kind,
                maybeChildren: createAbridgedDocumentSymbols(documentSymbol.children),
            };
        } else {
            return {
                name: documentSymbol.name,
                kind: documentSymbol.kind,
            };
        }
    });
}

export async function createCompletionItems(
    text: string,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Promise<ReadonlyArray<CompletionItem>> {
    return createAnalysis(text, maybeLibrary, maybeAnalysisOptions).getCompletionItems();
}

export async function createCompletionItemsForFile(
    fileName: string,
    position: Position,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Promise<ReadonlyArray<CompletionItem>> {
    return createFileAnalysis(fileName, position, maybeLibrary, maybeAnalysisOptions).getCompletionItems();
}

export async function createHover(
    text: string,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Promise<Hover> {
    return createAnalysis(text, maybeLibrary, maybeAnalysisOptions).getHover();
}

export async function createSignatureHelp(
    text: string,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Promise<SignatureHelp> {
    return createAnalysis(text, maybeLibrary, maybeAnalysisOptions).getSignatureHelp();
}

export function validateError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.code);
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

// export function dumpNodeToTraceFile(node: PQP.Language.Ast.INode, filePath: string): void {
//     const asJson: string = JSON.stringify(node);
//     File.writeFileSync(filePath, asJson);
// }

function createAnalysis(text: string, maybeLibrary?: ILibrary, maybeAnalysisOptions?: AnalysisOptions): Analysis {
    const [document, position]: [MockDocument, Position] = documentAndPositionFrom(text);
    return AnalysisUtils.createAnalysis(
        document,
        position,
        maybeLibrary ?? TestConstants.SimpleLibrary,
        createAnalysisOptions(maybeAnalysisOptions),
    );
}

function createFileAnalysis(
    fileName: string,
    position: Position,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Analysis {
    const document: MockDocument = documentFromText(readFile(fileName));
    return AnalysisUtils.createAnalysis(
        document,
        position,
        maybeLibrary ?? TestConstants.SimpleLibrary,
        createAnalysisOptions(maybeAnalysisOptions),
    );
}

function createAnalysisOptions(maybeAnalysisOptions?: AnalysisOptions): AnalysisOptions {
    return {
        ...TestConstants.SimpleLibraryAnalysisOptions,
        ...(maybeAnalysisOptions ?? {}),
    };
}

function validateTextWithMarker(text: string): void {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");
}
