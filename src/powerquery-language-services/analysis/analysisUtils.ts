// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position } from "vscode-languageserver-types";

import { Analysis } from "./analysis";
import { AnalysisSettings } from "./analysisSettings";
import { DocumentAnalysis } from "./documentAnalysis";

export function createAnalysis(
    document: TextDocument,
    analysisSettings: AnalysisSettings,
    position: Position,
): Analysis {
    return new DocumentAnalysis(document, analysisSettings, position);
}
