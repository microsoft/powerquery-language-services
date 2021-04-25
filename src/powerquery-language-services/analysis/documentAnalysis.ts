// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position, Range } from "vscode-languageserver-types";

import { ILibrary } from "../library/library";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { AnalysisBase } from "./analysisBase";
import { AnalysisSettings } from "./analysisSettings";

export class DocumentAnalysis<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> extends AnalysisBase<S> {
    constructor(
        analysisSettings: AnalysisSettings<S>,
        private readonly document: TextDocument,
        position: Position,
        library: ILibrary,
    ) {
        super(
            analysisSettings,
            WorkspaceCacheUtils.getOrCreateInspection(document, analysisSettings.createInspectionSettings(), position),
            position,
            library,
        );
    }

    public dispose(): void {
        if (!this.analysisSettings.maintainWorkspaceCache) {
            WorkspaceCacheUtils.close(this.document);
        }
    }

    protected getLexerState(): WorkspaceCache.LexCacheItem {
        return WorkspaceCacheUtils.getOrCreateLex(this.document, this.analysisSettings.createInspectionSettings());
    }

    protected getText(range?: Range): string {
        return this.document.getText(range);
    }
}
