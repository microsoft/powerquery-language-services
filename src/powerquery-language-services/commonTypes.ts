// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    CompletionItem,
    CompletionItemKind,
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    DocumentSymbol,
    FoldingRange,
    FoldingRangeKind,
    Hover,
    Location,
    MarkedString,
    MarkupContent,
    Position,
    Range,
    SignatureHelp,
    SymbolKind,
    TextEdit,
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
    FoldingRange,
    FoldingRangeKind,
    Hover,
    Location,
    MarkedString,
    MarkupContent,
    Position,
    Range,
    SignatureHelp,
    SymbolKind,
    TextDocument,
    TextDocumentContentChangeEvent,
    TextEdit,
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
