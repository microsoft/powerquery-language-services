// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";

export interface TestCancellationTokenOptions {
    /**
     * Number of calls to isCancelled/throwIfCancelled before triggering cancellation.
     * If not specified, token will only be cancelled via manual cancel() call.
     */
    cancelAfterCount?: number;

    /**
     * Delay in milliseconds before setting cancelled state (via setTimeout).
     * Defaults to 0ms to simulate async cancellation behavior.
     */
    asyncDelayMs?: number;
}

/**
 * Creates a test cancellation token that can be cancelled manually or after a specified number of calls.
 * This is useful for testing cancellation behavior in async operations.
 *
 * @param options Configuration for the cancellation token behavior
 * @returns A cancellation token with a cancel method for testing
 */
export function createTestCancellationToken(options?: TestCancellationTokenOptions): ICancellationToken {
    let isCancelled: boolean = false;
    let callCount: number = 0;
    const cancelAfterCount: number | undefined = options?.cancelAfterCount;
    const asyncDelayMs: number = options?.asyncDelayMs ?? 0;

    const checkAndTriggerCancellation: () => void = (): void => {
        callCount += 1;

        if (cancelAfterCount !== undefined && callCount >= cancelAfterCount && !isCancelled) {
            // Use setTimeout to simulate async cancellation behavior
            setTimeout(() => {
                isCancelled = true;
            }, asyncDelayMs);
        }
    };

    return {
        isCancelled: (): boolean => {
            checkAndTriggerCancellation();

            return isCancelled;
        },
        throwIfCancelled: (): void => {
            checkAndTriggerCancellation();

            if (isCancelled) {
                throw new Error("Operation was cancelled");
            }
        },
        cancel: (_reason: string): void => {
            isCancelled = true;
        },
    };
}
