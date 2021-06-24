// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position, Range } from "vscode-languageserver-types";

import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { AnalysisBase } from "./analysisBase";
import { AnalysisSettings } from "./analysisSettings";

export class DocumentAnalysis extends AnalysisBase {
    constructor(private readonly textDocument: TextDocument, analysisSettings: AnalysisSettings, position: Position) {
        super(
            analysisSettings,
            WorkspaceCacheUtils.getOrCreateInspection(
                textDocument,
                analysisSettings.createInspectionSettingsFn(),
                position,
            ),
            position,
        );
    }

    public dispose(): void {
        if (!this.analysisSettings.maintainWorkspaceCache) {
            WorkspaceCacheUtils.close(this.textDocument);
        }
    }

    protected getLexerState(): WorkspaceCache.LexCacheItem {
        return WorkspaceCacheUtils.getOrCreateLex(
            this.textDocument,
            this.analysisSettings.createInspectionSettingsFn(),
        );
    }

    protected getText(range?: Range): string {
        return this.textDocument.getText(range);
    }
}
