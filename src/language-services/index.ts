// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TextDocument } from "vscode-languageserver-types";
import * as LanguageServiceUtils from "./languageServiceUtils";
import * as InspectionUtils from "./inspectionUtils";
import * as WorkspaceCache from "./workspaceCache";

export { LanguageServiceUtils, InspectionUtils, WorkspaceCache };
export * from "./analysis";
export * from "./providers";
export * from "./validation";

export function documentUpdated(document: TextDocument): void {
    WorkspaceCache.update(document);
}

export function documentClosed(document: TextDocument): void {
    WorkspaceCache.close(document);
}
