// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import type {
    CompletionItem,
    Diagnostic,
    DocumentSymbol,
    Hover,
    Position,
    Range,
    SignatureHelp,
} from "vscode-languageserver-types";
import { CompletionItemKind, DiagnosticSeverity, SymbolKind } from "vscode-languageserver-types";

export type {
    CompletionItem,
    Diagnostic,
    DocumentSymbol,
    DocumentUri,
    Hover,
    Position,
    Range,
    SignatureHelp,
    TextDocument,
};
export { CompletionItemKind, DiagnosticSeverity, SymbolKind };

export interface IDisposable {
    dispose(): void;
}
