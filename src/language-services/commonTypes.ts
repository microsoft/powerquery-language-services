// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import type { Diagnostic, Position, Range } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

export type { Diagnostic, DocumentUri, Position, Range, TextDocument };
export { DiagnosticSeverity };

export interface IDisposable {
    dispose(): void;
}
