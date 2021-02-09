// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position, Range } from "vscode-languageserver-types";

import * as WorkspaceCache from "../workspaceCache";

import { AnalysisBase } from "./analysisBase";
import { AnalysisOptions } from "./analysisOptions";

export class DocumentAnalysis extends AnalysisBase {
    constructor(private readonly document: TextDocument, position: Position, options: AnalysisOptions) {
        super(
            WorkspaceCache.getTriedInspection(
                document,
                position,
                options.locale,
                options.localDocumentSymbolProvider?.externalTypeResolver,
            ),
            position,
            options,
        );
    }

    public dispose(): void {
        if (!this.options.maintainWorkspaceCache) {
            WorkspaceCache.close(this.document);
        }
    }

    protected getLexerState(): WorkspaceCache.LexerCacheItem {
        return WorkspaceCache.getLexerState(this.document, this.options.locale);
    }

    protected getText(range?: Range): string {
        return this.document.getText(range);
    }
}
