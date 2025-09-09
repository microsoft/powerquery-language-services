// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";

/**
 * Promise.all with cancellation support. Useful when you want parallel execution
 * but need the ability to cancel if needed.
 */
export async function promiseAllWithCancellation<T>(
    promises: Promise<T>[],
    cancellationToken?: ICancellationToken,
): Promise<T[]> {
    if (cancellationToken) {
        cancellationToken.throwIfCancelled();

        return new Promise((resolve, reject) => {
            let isFinished = false;

            const cancellationCheck = () => {
                if (isFinished) return;

                try {
                    cancellationToken.throwIfCancelled();
                } catch (error) {
                    isFinished = true;
                    reject(error);
                    return;
                }
                // Check again after a short delay
                setTimeout(cancellationCheck, 10);
            };

            // Start cancellation checking
            cancellationCheck();

            // Start the actual Promise.all
            Promise.all(promises).then(
                result => {
                    isFinished = true;
                    resolve(result);
                },
                error => {
                    isFinished = true;
                    reject(error);
                },
            );
        });
    }

    return Promise.all(promises);
}

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
        const result = await processor(item);
        results.push(result);
    }

    return results;
}
