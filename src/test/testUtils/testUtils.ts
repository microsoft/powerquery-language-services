// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as File from "fs";
import * as Path from "path";

import { Assert } from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import {
    CompletionItem,
    DocumentSymbol,
    Hover,
    Position,
    SignatureHelp,
    SymbolKind,
} from "vscode-languageserver-types";

import * as AnalysisUtils from "../../powerquery-language-services/analysis/analysisUtils";
import * as TestConstants from "../testConstants";

import { Analysis } from "../../powerquery-language-services";
import { AnalysisOptions } from "../../powerquery-language-services/analysis/analysisOptions";
import { ILibrary } from "../../powerquery-language-services/library/library";
import { MockDocument } from "../mockDocument";

export interface AbridgedDocumentSymbol {
    readonly name: string;
    readonly kind: SymbolKind;
    readonly maybeChildren?: ReadonlyArray<AbridgedDocumentSymbol>;
}

export type AbridgedSignatureHelp = Pick<SignatureHelp, "activeSignature" | "activeParameter">;

export function assertGetCompletionItem(label: string, completionItems: ReadonlyArray<CompletionItem>): CompletionItem {
    return Assert.asDefined(
        completionItems.find((completionitem: CompletionItem) => completionitem.label === "Test.Foo"),
        `did not find the expected completion item`,
        { label, completionItemLabels: completionItems.map((completionItem: CompletionItem) => completionItem.label) },
    );
}

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

export function createAbridgedSignatureHelp(value: SignatureHelp): AbridgedSignatureHelp {
    return {
        activeParameter: value.activeParameter,
        activeSignature: value.activeSignature,
    };
}

export function createAnalysis(
    text: string,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Analysis {
    const [document, position]: [MockDocument, Position] = createMockDocumentAndPosition(text);
    return AnalysisUtils.createAnalysis(
        document,
        position,
        maybeLibrary ?? TestConstants.SimpleLibrary,
        createAnalysisOptions(maybeAnalysisOptions),
    );
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

// export function dumpNodeToTraceFile(node: PQP.Language.Ast.INode, filePath: string): void {
//     const asJson: string = JSON.stringify(node);
//     File.writeFileSync(filePath, asJson);
// }

function createFileAnalysis(
    fileName: string,
    position: Position,
    maybeLibrary?: ILibrary,
    maybeAnalysisOptions?: AnalysisOptions,
): Analysis {
    const document: MockDocument = createTextMockDocument(readFile(fileName));
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
