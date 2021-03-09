// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position, Range } from "vscode-languageserver-types";

import { ILibrary } from "../library/library";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { AnalysisBase } from "./analysisBase";
import { AnalysisOptions } from "./analysisOptions";

export class DocumentAnalysis extends AnalysisBase {
    constructor(
        private readonly document: TextDocument,
        position: Position,
        library: ILibrary,
        options: AnalysisOptions,
    ) {
        super(
            WorkspaceCacheUtils.getTriedInspection(document, position, library.externalTypeResolver, options.locale),
            position,
            library,
            options,
        );
    }

    public dispose(): void {
        if (!this.options.maintainWorkspaceCache) {
            WorkspaceCacheUtils.close(this.document);
        }
    }

    protected getLexerState(): WorkspaceCache.LexCacheItem {
        return WorkspaceCacheUtils.getLexerState(this.document, this.options.locale);
    }

    protected getText(range?: Range): string {
        return this.document.getText(range);
    }
}
