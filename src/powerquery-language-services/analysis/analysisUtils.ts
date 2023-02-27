// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";

import { Analysis } from "./analysis";
import { AnalysisSettings } from "./analysisSettings";
import { DocumentAnalysis } from "./documentAnalysis";

const analysisByUri: Map<string, [Analysis, number]> = new Map();

// If AnalysisSettings.isWorkspaceCacheAllowed is true then the analysis will be cached by its URI.
// A URI with an updated version will cause a new Analysis to be generated and cached.
export function analysis(document: TextDocument, analysisSettings: AnalysisSettings): Analysis {
    const cacheKey: string = document.uri.toString();

    if (analysisSettings.isWorkspaceCacheAllowed && analysisByUri.has(cacheKey)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const [analysis, version]: [Analysis, number] = analysisByUri.get(cacheKey)!;

        if (version === document.version) {
            return analysis;
        } else {
            analysisByUri.delete(cacheKey);
        }
    }

    const analysis: Analysis = new DocumentAnalysis(document, analysisSettings);

    if (analysisSettings.isWorkspaceCacheAllowed) {
        analysisByUri.set(cacheKey, [analysis, document.version]);
    }

    return analysis;
}
