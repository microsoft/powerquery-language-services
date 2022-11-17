// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    CompletionItem,
    CompletionItemKind,
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    DocumentSymbol,
    Hover,
    MarkedString,
    MarkupContent,
    Position,
    Range,
    SignatureHelp,
    SymbolKind,
} from "vscode-languageserver-types";
import { DocumentUri, TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";

export {
    CompletionItem,
    CompletionItemKind,
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    DocumentSymbol,
    DocumentUri,
    Hover,
    MarkedString,
    MarkupContent,
    Position,
    Range,
    SignatureHelp,
    SymbolKind,
    TextDocument,
    TextDocumentContentChangeEvent,
};

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
