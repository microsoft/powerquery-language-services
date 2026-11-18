// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Analysis, AnalysisSettings, AnalysisUtils, TextDocument, textDocument } from "../src";
import { TestConstants } from ".";

interface DisposalTracker {
    readonly count: () => number;
    readonly dispose: () => void;
}

describe(`Analysis cache`, () => {
    afterEach(() => {
        AnalysisUtils.clearCache();
    });

    it(`reuses an analysis for the same URI, version, and settings`, () => {
        const document: TextDocument = textDocument("reuse", 1, "let x = 1 in x");
        const first: Analysis = AnalysisUtils.analysis(document, cacheSettings());
        const second: Analysis = AnalysisUtils.analysis(document, cacheSettings());

        expect(second).to.equal(first);
    });

    it(`replaces and disposes an analysis when its settings change`, () => {
        const document: TextDocument = textDocument("settings-change", 1, "let x = 1 in x");
        const first: Analysis = AnalysisUtils.analysis(document, cacheSettings());
        const disposeTracker: DisposalTracker = trackDisposal(first);

        const changedSettings: AnalysisSettings = cacheSettings({
            inspectionSettings: {
                ...TestConstants.SimpleLibraryAnalysisSettings.inspectionSettings,
                library: TestConstants.EmptyLibrary,
            },
        });

        const second: Analysis = AnalysisUtils.analysis(document, changedSettings);

        expect(second).not.to.equal(first);
        expect(disposeTracker.count()).to.equal(1);
    });

    it(`replaces and disposes an analysis when its document version changes`, () => {
        const first: Analysis = AnalysisUtils.analysis(textDocument("version-change", 1, "1"), cacheSettings());
        const disposeTracker: DisposalTracker = trackDisposal(first);

        const second: Analysis = AnalysisUtils.analysis(textDocument("version-change", 2, "2"), cacheSettings());

        expect(second).not.to.equal(first);
        expect(disposeTracker.count()).to.equal(1);
    });

    it(`invalidates and disposes only the targeted URI`, () => {
        const firstDocument: TextDocument = textDocument("targeted", 1, "let x = 1 in x");
        const secondDocument: TextDocument = textDocument("untargeted", 1, "let x = 2 in x");
        const first: Analysis = AnalysisUtils.analysis(firstDocument, cacheSettings());
        const second: Analysis = AnalysisUtils.analysis(secondDocument, cacheSettings());
        const firstDisposeTracker: DisposalTracker = trackDisposal(first);
        const secondDisposeTracker: DisposalTracker = trackDisposal(second);

        expect(AnalysisUtils.invalidateCache(firstDocument.uri)).to.be.true;
        expect(AnalysisUtils.invalidateCache(firstDocument.uri)).to.be.false;
        expect(firstDisposeTracker.count()).to.equal(1);
        expect(secondDisposeTracker.count()).to.equal(0);
        expect(AnalysisUtils.analysis(firstDocument, cacheSettings())).not.to.equal(first);
        expect(AnalysisUtils.analysis(secondDocument, cacheSettings())).to.equal(second);
    });

    it(`clears and disposes all cached analyses`, () => {
        const first: Analysis = AnalysisUtils.analysis(textDocument("clear-first", 1, "1"), cacheSettings());
        const second: Analysis = AnalysisUtils.analysis(textDocument("clear-second", 1, "2"), cacheSettings());
        const firstDisposeTracker: DisposalTracker = trackDisposal(first);
        const secondDisposeTracker: DisposalTracker = trackDisposal(second);

        AnalysisUtils.clearCache();

        expect(firstDisposeTracker.count()).to.equal(1);
        expect(secondDisposeTracker.count()).to.equal(1);
    });

    it(`leaves uncached analyses under caller ownership`, () => {
        const analysis: Analysis = AnalysisUtils.analysis(
            textDocument("uncached", 1, "let x = 1 in x"),
            cacheSettings({ isWorkspaceCacheAllowed: false }),
        );

        const disposeTracker: DisposalTracker = trackDisposal(analysis);
        AnalysisUtils.clearCache();

        expect(disposeTracker.count()).to.equal(0);
        disposeTracker.dispose();
    });
});

function cacheSettings(overrides: Partial<AnalysisSettings> = {}): AnalysisSettings {
    return {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        ...overrides,
        isWorkspaceCacheAllowed: overrides.isWorkspaceCacheAllowed ?? true,
    };
}

function trackDisposal(analysis: Analysis): DisposalTracker {
    const dispose: () => void = analysis.dispose.bind(analysis);
    let count: number = 0;

    analysis.dispose = (): void => {
        count += 1;
        dispose();
    };

    return {
        count: () => count,
        dispose,
    };
}
