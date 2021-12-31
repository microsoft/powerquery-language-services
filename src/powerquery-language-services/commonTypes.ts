// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type {
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
import type { DocumentUri, TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";

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
    activeParameter: null,
    activeSignature: null,
};
