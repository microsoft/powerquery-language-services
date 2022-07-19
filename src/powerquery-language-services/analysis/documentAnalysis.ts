// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Position, Range } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { AnalysisBase } from "./analysisBase";
import { AnalysisSettings } from "./analysisSettings";
import { InspectionSettings } from "../inspectionSettings";
import { WorkspaceCacheUtils } from "../workspaceCache";

export class DocumentAnalysis extends AnalysisBase {
    constructor(private readonly textDocument: TextDocument, analysisSettings: AnalysisSettings, position: Position) {
        const inspectionSettings: InspectionSettings = analysisSettings.createInspectionSettingsFn();

        super(
            textDocument.uri,
            analysisSettings,
            inspectionSettings,
            WorkspaceCacheUtils.getOrCreateInspectedPromise(textDocument, inspectionSettings, position),
        );
    }

    public dispose(): void {
        if (!this.analysisSettings.isWorkspaceCacheAllowed) {
            WorkspaceCacheUtils.close(this.textDocument);
        }
    }

    protected getText(range?: Range): string {
        return this.textDocument.getText(range);
    }
}
