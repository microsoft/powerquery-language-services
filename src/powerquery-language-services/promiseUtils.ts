// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";

/**
 * Sequential processing with cancellation support - often better than Promise.all
 * for cancellation scenarios because we can stop between each operation.
 */
export async function processSequentiallyWithCancellation<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    cancellationToken?: ICancellationToken,
): Promise<R[]> {
    const results: R[] = [];

    for (const item of items) {
        cancellationToken?.throwIfCancelled();
        // eslint-disable-next-line no-await-in-loop
        const result: R = await processor(item);
        results.push(result);
    }

    return results;
}

export async function yieldForCancellation(cancellationToken?: ICancellationToken): Promise<void> {
    if (cancellationToken) {
        await Promise.resolve();
        cancellationToken.throwIfCancelled();
    }

    return Promise.resolve();
}
