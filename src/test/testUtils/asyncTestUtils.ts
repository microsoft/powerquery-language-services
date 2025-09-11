// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";

/**
 * Creates a test cancellation token that can be cancelled manually.
 * This is useful for testing cancellation behavior in async operations.
 *
 * @returns A cancellation token with a cancel method for testing
 */
export function createTestCancellationToken(): ICancellationToken {
    let isCancelled: boolean = false;

    return {
        isCancelled: (): boolean => isCancelled,
        throwIfCancelled: (): void => {
            if (isCancelled) {
                throw new Error("Operation was cancelled");
            }
        },
        cancel: (_reason: string): void => {
            isCancelled = true;
        },
    };
}
