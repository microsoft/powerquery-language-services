// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import * as WorkspaceCache from "./workspaceCache";

export * from "./analysis";
export * from "./commonTypes";
export * from "./formatter";
export * from "./providers";
export * from "./validation";

export function documentUpdated(
    document: TextDocument,
    changes: TextDocumentContentChangeEvent[],
    version: number,
): void {
    WorkspaceCache.update(document, changes, version);
}

export function documentClosed(document: TextDocument): void {
    WorkspaceCache.close(document);
}
