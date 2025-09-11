// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { setImmediate } from "timers";

/**
 * Sequential processing with cancellation support - often better than Promise.all
 * for cancellation scenarios because we can stop between each operation.
 * Also yields control before each operation to allow cancellation tokens to take effect.
 */
export async function processSequentiallyWithCancellation<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    cancellationToken?: ICancellationToken,
): Promise<R[]> {
    const results: R[] = [];

    for (const item of items) {
        // Yield control to allow async cancellation tokens to take effect
        // eslint-disable-next-line no-await-in-loop
        await yieldForCancellation(cancellationToken);

        // eslint-disable-next-line no-await-in-loop
        const result: R = await processor(item);
        results.push(result);
    }

    return results;
}

export async function yieldForCancellation(cancellationToken?: ICancellationToken): Promise<void> {
    if (cancellationToken) {
        // First yield to microtasks (handles synchronous cancellation)
        await Promise.resolve();
        cancellationToken.throwIfCancelled();

        // Additional yield for setImmediate-based cancellation tokens
        // This ensures we yield to the timer queue where setImmediate callbacks execute
        await new Promise<void>((resolve: () => void) => setImmediate(resolve));
        cancellationToken.throwIfCancelled();
    }

    return Promise.resolve();
}
