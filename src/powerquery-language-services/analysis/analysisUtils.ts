// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";

import { Analysis } from "./analysis";
import { AnalysisSettings } from "./analysisSettings";
import { DocumentAnalysis } from "./documentAnalysis";

const analysisByUri: Map<string, [Analysis, number]> = new Map();

export function createAnalysis(document: TextDocument, analysisSettings: AnalysisSettings): Analysis {
    const cacheKey: string = document.uri.toString();

    if (analysisByUri.has(cacheKey)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const [analysis, version]: [Analysis, number] = analysisByUri.get(cacheKey)!;

        if (version === document.version) {
            return analysis;
        } else {
            analysisByUri.delete(cacheKey);
        }
    }

    const analysis: Analysis = new DocumentAnalysis(document, analysisSettings);
    analysisByUri.set(cacheKey, [analysis, document.version]);

    return analysis;
}
