// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import type { Diagnostic, Position, Range } from "vscode-languageserver-types";
import { DiagnosticSeverity } from "vscode-languageserver-types";

export type { Diagnostic, DiagnosticSeverity, DocumentUri, Position, Range, TextDocument };

export interface IDisposable {
    dispose(): void;
}
