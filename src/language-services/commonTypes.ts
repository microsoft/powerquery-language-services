// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import type { Diagnostic, Position, Range } from "vscode-languageserver-types";

export type { Diagnostic, DocumentUri, Position, Range, TextDocument };

export const enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

export interface IDisposable {
    dispose(): void;
}
