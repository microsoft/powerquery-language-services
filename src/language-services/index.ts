// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";
import * as WorkspaceCache from "./workspaceCache";

export * from "./analysis";
export * from "./formatter";
export * from "./providers";
export * from "./validation";

// TODO: Add LSP exports required to use this library

export function documentUpdated(document: TextDocument): void {
    WorkspaceCache.update(document);
}

export function documentClosed(document: TextDocument): void {
    WorkspaceCache.close(document);
}
