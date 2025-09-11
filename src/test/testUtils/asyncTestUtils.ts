// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "@microsoft/powerquery-parser";
import { setImmediate } from "timers";

export interface TestCancellationTokenOptions {
    /**
     * Number of calls to isCancelled/throwIfCancelled before triggering cancellation.
     * If not specified, token will only be cancelled via manual cancel() call.
     */
    cancelAfterCount?: number;

    /**
     * Delay before setting cancelled state.
     * - undefined: Synchronous cancellation (for deterministic tests)
     * - 0: Use setImmediate for immediate async cancellation (better for async validation)
     * - >0: Use setTimeout with the specified delay in milliseconds
     */
    asyncDelayMs?: number;

    /**
     * Test identifier for logging purposes.
     * When provided, will log the final call count when the test completes.
     */
    testId?: string;
}

/**
 * Creates a test cancellation token that can be cancelled manually or after a specified number of calls.
 * This is useful for testing cancellation behavior in async operations.
 *
 * @param options Configuration for the cancellation token behavior
 * @returns A cancellation token with a cancel method for testing
 */
export function createTestCancellationToken(
    options?: TestCancellationTokenOptions,
): ICancellationToken & { getCallCount: () => number } {
    let isCancelled: boolean = false;
    let callCount: number = 0;
    let cancellationScheduled: boolean = false; // Prevent multiple async cancellations
    const cancelAfterCount: number | undefined = options?.cancelAfterCount;
    const asyncDelayMs: number | undefined = options?.asyncDelayMs;
    const testId: string | undefined = options?.testId;

    const checkAndTriggerCancellation: () => void = (): void => {
        callCount += 1;

        if (cancelAfterCount !== undefined && callCount >= cancelAfterCount && !isCancelled && !cancellationScheduled) {
            cancellationScheduled = true; // Mark that we've scheduled cancellation

            if (asyncDelayMs === undefined) {
                // Synchronous cancellation for deterministic tests
                isCancelled = true;

                if (testId) {
                    console.log(
                        `${testId}: Cancellation triggered at call ${callCount} (threshold: ${cancelAfterCount}) [synchronous]`,
                    );
                }
            } else if (asyncDelayMs === 0) {
                // Use setImmediate for immediate async cancellation (better for async validation)
                setImmediate(() => {
                    isCancelled = true;

                    if (testId) {
                        console.log(
                            `${testId}: Cancellation triggered at call ${callCount} (threshold: ${cancelAfterCount}) [setImmediate]`,
                        );
                    }
                });
            } else {
                // Use setTimeout with the specified delay
                setTimeout(() => {
                    isCancelled = true;

                    if (testId) {
                        console.log(
                            `${testId}: Cancellation triggered at call ${callCount} (threshold: ${cancelAfterCount}) [setTimeout:${asyncDelayMs}ms]`,
                        );
                    }
                }, asyncDelayMs);
            }
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
        getCallCount: (): number => callCount,
    };
}
