// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Range } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { AnalysisSettings } from "./analysisSettings";
import { MemoizedAnalysis } from "./memoizedAnalysis";

export class DocumentAnalysis extends MemoizedAnalysis {
    constructor(textDocument: TextDocument, analysisSettings: AnalysisSettings) {
        super(textDocument, analysisSettings);
    }

    protected getText(range?: Range): string {
        return this.textDocument.getText(range);
    }
}
