// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { CommonError, Result } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import {
    Analysis,
    AnalysisSettings,
    AnalysisUtils,
    Hover,
    HoverProviderContext,
    Library,
    LibraryProvider,
    Position,
    TextDocument,
    textDocument,
} from "../src";
import { TestConstants, TestUtils } from ".";

interface DisposalTracker {
    readonly count: () => number;
    readonly dispose: () => void;
}

interface Deferred {
    readonly promise: Promise<void>;
    readonly resolve: () => void;
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
        const document: TextDocument = textDocument("uncached", 1, "let x = 1 in x");
        const cached: Analysis = AnalysisUtils.analysis(document, cacheSettings());
        const cachedDisposeTracker: DisposalTracker = trackDisposal(cached);

        const uncached: Analysis = AnalysisUtils.analysis(document, cacheSettings({ isWorkspaceCacheAllowed: false }));

        const uncachedDisposeTracker: DisposalTracker = trackDisposal(uncached);

        expect(uncached).not.to.equal(cached);
        expect(AnalysisUtils.analysis(document, cacheSettings())).to.equal(cached);
        expect(cachedDisposeTracker.count()).to.equal(0);
        AnalysisUtils.clearCache();

        expect(cachedDisposeTracker.count()).to.equal(1);
        expect(uncachedDisposeTracker.count()).to.equal(0);
        uncachedDisposeTracker.dispose();
    });

    it(`defers disposal until a pending inspection finishes after invalidation`, async () => {
        await assertPendingDisposal((document: TextDocument, settings: AnalysisSettings): Analysis => {
            expect(AnalysisUtils.invalidateCache(document.uri)).to.be.true;

            return AnalysisUtils.analysis(document, settings);
        });
    });

    it(`defers disposal until a pending inspection finishes after replacement`, async () => {
        await assertPendingDisposal(
            (document: TextDocument, settings: AnalysisSettings): Analysis =>
                AnalysisUtils.analysis(document, {
                    ...settings,
                    inspectionSettings: {
                        ...settings.inspectionSettings,
                        library: TestConstants.EmptyLibrary,
                    },
                }),
        );
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

async function assertPendingDisposal(
    replaceOrInvalidate: (document: TextDocument, settings: AnalysisSettings) => Analysis,
): Promise<void> {
    const [text, position]: [string, Position] = TestUtils.extractPosition("let x = 1 in x|");
    const document: TextDocument = textDocument("pending-disposal", 1, text);
    const started: Deferred = deferred();
    const blocked: Deferred = deferred();

    const settings: AnalysisSettings = cacheSettings({
        libraryProviderFactory: (library: Library.ILibrary, locale: string): BlockingLibraryProvider =>
            new BlockingLibraryProvider(library, locale, started, blocked),
    });

    const analysis: Analysis = AnalysisUtils.analysis(document, settings);
    const disposeTracker: DisposalTracker = trackDisposal(analysis);
    const pending: Promise<Result<Hover | undefined, CommonError.CommonError>> = analysis.getHover(position);

    await started.promise;
    const scopeCount: number = analysis.getTypeCache().scopeById.scopes.size;
    expect(scopeCount).to.be.greaterThan(0);

    const replacement: Analysis = replaceOrInvalidate(document, settings);
    expect(replacement).not.to.equal(analysis);
    expect(analysis.getTypeCache().scopeById.scopes.size).to.equal(scopeCount);

    blocked.resolve();
    await pending;
    await Promise.resolve();

    expect(disposeTracker.count()).to.equal(1);
    expect(analysis.getTypeCache().scopeById.scopes.size).to.equal(0);
}

function deferred(): Deferred {
    let resolve: () => void = (): never => {
        throw new Error("Deferred promise has not been initialized");
    };

    const promise: Promise<void> = new Promise((resolvePromise: () => void) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
}

class BlockingLibraryProvider extends LibraryProvider {
    public constructor(
        library: Library.ILibrary,
        locale: string,
        private readonly started: Deferred,
        private readonly blocked: Deferred,
    ) {
        super(library, locale);
    }

    public override async getHover(
        context: HoverProviderContext,
    ): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        this.started.resolve();
        await this.blocked.promise;

        return super.getHover(context);
    }
}
