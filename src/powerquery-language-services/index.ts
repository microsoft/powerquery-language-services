// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import { WorkspaceCacheUtils } from "./workspaceCache";

export * from "./analysis";
export * from "./commonTypes";
export * from "./diagnosticErrorCode";
export * from "./documentSymbols";
export * as InspectionUtils from "./inspectionUtils";
export * from "./formatter";
export * from "./library";
export * from "./providers";
export * from "./validation";
export * from "./workspaceCache";

export function createTextDocument(id: string, version: number, content: string): TextDocument {
    return TextDocument.create(id, "powerquery", version, content);
}

export function documentUpdated(
    document: TextDocument,
    changes: ReadonlyArray<TextDocumentContentChangeEvent>,
    version: number,
): void {
    WorkspaceCacheUtils.update(document, changes, version);
}

export function documentClosed(document: TextDocument): void {
    WorkspaceCacheUtils.close(document);
}
