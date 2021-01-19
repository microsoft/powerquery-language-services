// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position } from "vscode-languageserver-types";

import { Analysis } from "./analysis";
import { AnalysisOptions } from "./analysisOptions";
import { DocumentAnalysis } from "./documentAnalysis";

export function createAnalysis(document: TextDocument, position: Position, options: AnalysisOptions): Analysis {
    return new DocumentAnalysis(document, position, options);
}
