// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Position } from "vscode-languageserver-types";

import { ILibrary } from "../library/library";
import { Analysis } from "./analysis";
import { AnalysisSettings } from "./analysisSettings";
import { DocumentAnalysis } from "./documentAnalysis";

export function createAnalysis<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    document: TextDocument,
    analysisSettings: AnalysisSettings<S>,
    position: Position,
    library: ILibrary,
): Analysis {
    return new DocumentAnalysis(analysisSettings, document, position, library);
}
