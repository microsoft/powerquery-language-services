// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { TextDocument } from "vscode-languageserver-textdocument";

import { Analysis } from "./analysis";
import { AnalysisSettings } from "./analysisSettings";
import { DocumentAnalysis } from "./documentAnalysis";

interface CachedAnalysis {
    readonly analysis: Analysis;
    readonly analysisSettings: AnalysisSettings;
    readonly version: number;
}

const analysisByUri: Map<string, CachedAnalysis> = new Map();

// If AnalysisSettings.isWorkspaceCacheAllowed is true then the analysis will be cached by its URI.
// A URI with an updated version or settings will cause a new Analysis to be generated and cached.
export function analysis(document: TextDocument, analysisSettings: AnalysisSettings): Analysis {
    if (!analysisSettings.isWorkspaceCacheAllowed) {
        return new DocumentAnalysis(document, analysisSettings);
    }

    const cacheKey: string = document.uri.toString();
    const cachedAnalysis: CachedAnalysis | undefined = analysisByUri.get(cacheKey);

    if (cachedAnalysis !== undefined) {
        if (
            cachedAnalysis.version === document.version &&
            areAnalysisSettingsEqual(cachedAnalysis.analysisSettings, analysisSettings)
        ) {
            return cachedAnalysis.analysis;
        }

        analysisByUri.delete(cacheKey);
        cachedAnalysis.analysis.dispose();
    }

    const analysis: Analysis = new DocumentAnalysis(document, analysisSettings);

    analysisByUri.set(cacheKey, {
        analysis,
        analysisSettings: {
            ...analysisSettings,
            inspectionSettings: { ...analysisSettings.inspectionSettings },
        },
        version: document.version,
    });

    return analysis;
}

export function invalidateCache(uri: string): boolean {
    const cachedAnalysis: CachedAnalysis | undefined = analysisByUri.get(uri);

    if (cachedAnalysis === undefined) {
        return false;
    }

    analysisByUri.delete(uri);
    cachedAnalysis.analysis.dispose();

    return true;
}

export function clearCache(): void {
    const cachedAnalyses: ReadonlyArray<CachedAnalysis> = [...analysisByUri.values()];
    analysisByUri.clear();

    for (const cachedAnalysis of cachedAnalyses) {
        cachedAnalysis.analysis.dispose();
    }
}

function areAnalysisSettingsEqual(left: AnalysisSettings, right: AnalysisSettings): boolean {
    const { inspectionSettings: leftInspectionSettings, ...leftSettings }: AnalysisSettings = left;
    const { inspectionSettings: rightInspectionSettings, ...rightSettings }: AnalysisSettings = right;

    return (
        areShallowEqual(leftSettings, rightSettings) && areShallowEqual(leftInspectionSettings, rightInspectionSettings)
    );
}

function areShallowEqual(left: object, right: object): boolean {
    const leftRecord: Readonly<Record<string, unknown>> = left as Readonly<Record<string, unknown>>;
    const rightRecord: Readonly<Record<string, unknown>> = right as Readonly<Record<string, unknown>>;
    const leftKeys: ReadonlyArray<string> = Object.keys(leftRecord);
    const rightKeys: ReadonlyArray<string> = Object.keys(rightRecord);

    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every(
            (key: string) =>
                Object.prototype.hasOwnProperty.call(rightRecord, key) && Object.is(leftRecord[key], rightRecord[key]),
        )
    );
}
