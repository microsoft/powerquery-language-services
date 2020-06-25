// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import * as WorkspaceCache from "./workspaceCache";

export * from "./analysis";
export * from "./analysisOptions";
export * from "./commonTypes";
export * from "./documentSymbols";
export * from "./formatter";
export * from "./providers";
export * from "./validation";

export function createTextDocument(id: string, version: number, content: string): TextDocument {
    return TextDocument.create(id, "powerquery", version, content);
}

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
