// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Position, Range } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { AnalysisBase } from "./analysisBase";
import { AnalysisSettings } from "./analysisSettings";
import { WorkspaceCacheUtils } from "../workspaceCache";

export class DocumentAnalysis extends AnalysisBase {
    constructor(private readonly textDocument: TextDocument, analysisSettings: AnalysisSettings, position: Position) {
        super(
            analysisSettings,
            WorkspaceCacheUtils.getOrCreateInspectedPromise(
                textDocument,
                analysisSettings.createInspectionSettingsFn(),
                position,
            ),
        );
    }

    public dispose(): void {
        WorkspaceCacheUtils.close(this.textDocument);
    }

    protected getText(range?: Range): string {
        return this.textDocument.getText(range);
    }
}
