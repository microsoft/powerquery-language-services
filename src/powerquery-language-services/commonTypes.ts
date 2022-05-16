// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DocumentUri, TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";

import {
    CompletionItem,
    CompletionItemKind,
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    DocumentSymbol,
    Hover,
    Position,
    Range,
    SignatureHelp,
    SymbolKind,
} from "vscode-languageserver-types";

export type {
    CompletionItem,
    Diagnostic,
    DiagnosticRelatedInformation,
    DocumentSymbol,
    DocumentUri,
    Hover,
    Position,
    Range,
    SignatureHelp,
    TextDocument,
    TextDocumentContentChangeEvent,
};
export { CompletionItemKind, DiagnosticSeverity, SymbolKind };

export interface IDisposable {
    dispose(): void;
}

export const EmptyHover: Hover = {
    range: undefined,
    contents: [],
};

export const EmptySignatureHelp: SignatureHelp = {
    signatures: [],
    activeParameter: undefined,
    activeSignature: undefined,
};
