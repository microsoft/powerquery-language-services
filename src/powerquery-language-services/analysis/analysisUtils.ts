// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position } from "vscode-languageserver-types";

import { ILibrary } from "../library/library";
import { Analysis } from "./analysis";
import { AnalysisSettings } from "./analysisSettings";
import { DocumentAnalysis } from "./documentAnalysis";

export function createAnalysis(
    analysisSettings: AnalysisSettings,
    document: TextDocument,
    position: Position,
    library: ILibrary,
): Analysis {
    return new DocumentAnalysis(analysisSettings, document, position, library);
}
