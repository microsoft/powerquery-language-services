// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: Add LSP exports required to use this library

import type { Diagnostic, Position, Range } from "vscode-languageserver-types";

export type { Diagnostic, Position, Range };

export const enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

export interface IDisposable {
    dispose(): void;
}
