// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Analysis } from "./analysis";

interface AnalysisLifetime {
    activeOperations: number;
    disposeWhenIdle: (() => void) | undefined;
}

const lifetimeByAnalysis: WeakMap<Analysis, AnalysisLifetime> = new WeakMap();

export async function withDeferredDisposal<T>(analysis: Analysis, operation: () => Promise<T>): Promise<T> {
    const lifetime: AnalysisLifetime = getLifetime(analysis);
    lifetime.activeOperations += 1;

    try {
        return await operation();
    } finally {
        lifetime.activeOperations -= 1;
        disposeIfIdle(lifetime);
    }
}

export function requestDisposal(analysis: Analysis, dispose: () => void): void {
    const lifetime: AnalysisLifetime = getLifetime(analysis);
    lifetime.disposeWhenIdle = dispose;
    disposeIfIdle(lifetime);
}

function getLifetime(analysis: Analysis): AnalysisLifetime {
    let lifetime: AnalysisLifetime | undefined = lifetimeByAnalysis.get(analysis);

    if (lifetime === undefined) {
        lifetime = { activeOperations: 0, disposeWhenIdle: undefined };
        lifetimeByAnalysis.set(analysis, lifetime);
    }

    return lifetime;
}

function disposeIfIdle(lifetime: AnalysisLifetime): void {
    if (lifetime.activeOperations === 0 && lifetime.disposeWhenIdle !== undefined) {
        const dispose: () => void = lifetime.disposeWhenIdle;
        lifetime.disposeWhenIdle = undefined;
        dispose();
    }
}
