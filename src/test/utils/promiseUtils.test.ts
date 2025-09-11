// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";
import { ICancellationToken } from "@microsoft/powerquery-parser";

import { processSequentiallyWithCancellation } from "../../powerquery-language-services/promiseUtils";

function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
    );
}

/**
 * Helper function to test that an async operation throws an error with a specific message
 */
async function expectAsyncError<T>(
    operation: () => Promise<T>,
    expectedMessage: string,
    failureMessage?: string,
): Promise<void> {
    try {
        await operation();
        assert.fail(failureMessage ?? `Expected operation to throw an error containing "${expectedMessage}"`);
    } catch (error: unknown) {
        if (isErrorWithMessage(error)) {
            expect(error.message).to.contain(expectedMessage);
        } else {
            assert.fail("Caught error is not an object with a message property");
        }
    }
}

/**
 * Helper function to test cancellation behavior with timeout
 */
async function expectCancellationAfterTimeout<T>(
    operation: () => Promise<T>,
    cancellationToken: ICancellationToken & { cancel: (reason: string) => void },
    timeoutMs: number,
    cancellationReason: string = "Test cancellation",
    additionalAssertions?: () => void,
): Promise<void> {
    // Cancel after the specified timeout
    setTimeout(() => {
        cancellationToken.cancel(cancellationReason);
    }, timeoutMs);

    await expectAsyncError(operation, "cancelled", "Expected processing to be cancelled");

    // Run any additional assertions
    additionalAssertions?.();
}

function createTestCancellationToken(): ICancellationToken & { cancel: (reason: string) => void } {
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

/**
 * Interface for test setup return values
 */
interface TestSetup {
    readonly items: string[];
    readonly processor: (item: string) => Promise<string>;
    readonly cancellationToken: ICancellationToken & { cancel: (reason: string) => void };
    readonly processedItems: string[];
    readonly processorCallCount: () => number;
}

/**
 * Creates common test setup for string processing tests
 */
function testSetup(options?: {
    items?: string[];
    delayMs?: number;
    trackProcessed?: boolean;
    errorOnItem?: string;
    countCalls?: boolean;
}): TestSetup {
    const items: string[] = options?.items ?? ["a", "b", "c"];
    const delayMs: number = options?.delayMs ?? 0;
    const trackProcessed: boolean = options?.trackProcessed ?? false;
    const errorOnItem: string | undefined = options?.errorOnItem;
    const countCalls: boolean = options?.countCalls ?? false;

    const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } = createTestCancellationToken();
    const processedItems: string[] = [];
    let processorCallCount: number = 0;

    const processor: (item: string) => Promise<string> = async (item: string): Promise<string> => {
        if (countCalls) {
            processorCallCount += 1;
        }

        if (trackProcessed) {
            processedItems.push(item);
        }

        if (errorOnItem && item === errorOnItem) {
            throw new Error("Test processor error");
        }

        if (delayMs > 0) {
            await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, delayMs));
        }

        return item.toUpperCase();
    };

    return {
        items,
        processor,
        cancellationToken,
        processedItems,
        processorCallCount: (): number => processorCallCount,
    };
}

describe("Promise Utils", () => {
    describe("processSequentiallyWithCancellation", () => {
        it("should process all items sequentially when no cancellation token is provided", async () => {
            const { items, processor }: TestSetup = testSetup({
                delayMs: 10,
            });

            const result: string[] = await processSequentiallyWithCancellation(items, processor);
            expect(result).to.deep.equal(["A", "B", "C"]);
        });

        it("should process all items when cancellation token is not cancelled", async () => {
            const { items, processor, cancellationToken }: TestSetup = testSetup({
                delayMs: 10,
            });

            const result: string[] = await processSequentiallyWithCancellation(items, processor, cancellationToken);
            expect(result).to.deep.equal(["A", "B", "C"]);
            expect(cancellationToken.isCancelled()).to.be.false;
        });

        it("should stop processing when cancellation token is cancelled", async () => {
            const { items, processor, cancellationToken, processedItems }: TestSetup = testSetup({
                items: ["a", "b", "c", "d", "e"],
                delayMs: 20,
                trackProcessed: true,
            });

            await expectCancellationAfterTimeout(
                () => processSequentiallyWithCancellation(items, processor, cancellationToken),
                cancellationToken,
                35, // Should allow first item and start of second
                "Cancelled during processing",
                () => {
                    // Should have processed at least the first item, but not all
                    expect(processedItems.length).to.be.greaterThan(0);
                    expect(processedItems.length).to.be.lessThan(items.length);
                },
            );
        });

        it("should reject immediately if cancellation token is already cancelled", async () => {
            const { items, processor, cancellationToken }: TestSetup = testSetup();

            cancellationToken.cancel("Pre-cancelled");

            await expectAsyncError(
                () => processSequentiallyWithCancellation(items, processor, cancellationToken),
                "cancelled",
                "Expected processing to be rejected due to pre-cancelled token",
            );
        });

        it("should handle empty arrays", async () => {
            const { items, processor, cancellationToken }: TestSetup = testSetup({
                items: [],
            });

            const result: string[] = await processSequentiallyWithCancellation(items, processor, cancellationToken);
            expect(result).to.deep.equal([]);
        });

        it("should handle processor errors normally when not cancelled", async () => {
            const { items, processor, cancellationToken }: TestSetup = testSetup({
                errorOnItem: "b",
            });

            await expectAsyncError(
                () => processSequentiallyWithCancellation(items, processor, cancellationToken),
                "Test processor error",
                "Expected processing to be rejected due to processor error",
            );
        });

        it("should check cancellation before each item", async () => {
            const { items, processor, cancellationToken, processorCallCount }: TestSetup = testSetup({
                countCalls: true,
            });

            // Cancel before any processing
            cancellationToken.cancel("Pre-cancelled");

            await expectAsyncError(
                () => processSequentiallyWithCancellation(items, processor, cancellationToken),
                "cancelled",
                "Expected processing to be cancelled",
            );

            expect(processorCallCount()).to.equal(0, "Processor should not be called when pre-cancelled");
        });
    });

    describe("cancellation timing behavior", () => {
        it("should demonstrate different cancellation points in sequential processing", async () => {
            const { items, processor, cancellationToken, processedItems }: TestSetup = testSetup({
                items: ["first", "second", "third", "fourth", "fifth"],
                delayMs: 30,
                trackProcessed: true,
            });

            await expectCancellationAfterTimeout(
                () => processSequentiallyWithCancellation(items, processor, cancellationToken),
                cancellationToken,
                75, // Cancel after 75ms (should process ~2-3 items)
                "Timed cancellation",
                () => {
                    console.log(
                        `Processed ${processedItems.length} items before cancellation: [${processedItems.join(", ")}]`,
                    );

                    // Should have processed some but not all items
                    expect(processedItems.length).to.be.greaterThan(0);
                    expect(processedItems.length).to.be.lessThan(items.length);

                    // Should have processed items in order
                    for (let i: number = 0; i < processedItems.length; i = i + 1) {
                        expect(processedItems[i]).to.equal(items[i]);
                    }
                },
            );
        });
    });
});
