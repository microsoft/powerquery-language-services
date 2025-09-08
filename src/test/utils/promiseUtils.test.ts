// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";
import { ICancellationToken } from "@microsoft/powerquery-parser";

import {
    promiseAllWithCancellation,
    processSequentiallyWithCancellation,
} from "../../powerquery-language-services/utils/promiseUtils";

function createTestCancellationToken(): ICancellationToken & { cancel: (reason: string) => void } {
    let isCancelled = false;

    return {
        isCancelled: () => isCancelled,
        throwIfCancelled: () => {
            if (isCancelled) {
                throw new Error("Operation was cancelled");
            }
        },
        cancel: (_reason: string) => {
            isCancelled = true;
        },
    };
}

function createDelayedPromise(delayMs: number, value: string): Promise<string> {
    return new Promise(resolve => {
        setTimeout(() => resolve(value), delayMs);
    });
}

function createDelayedRejectingPromise(delayMs: number, errorMessage: string): Promise<string> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), delayMs);
    });
}

describe("Promise Utils", () => {
    describe("promiseAllWithCancellation", () => {
        it("should resolve all promises when no cancellation token is provided", async () => {
            const promises = [
                createDelayedPromise(10, "first"),
                createDelayedPromise(20, "second"),
                createDelayedPromise(15, "third"),
            ];

            const result = await promiseAllWithCancellation(promises);
            expect(result).to.deep.equal(["first", "second", "third"]);
        });

        it("should resolve all promises when cancellation token is not cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            const promises = [
                createDelayedPromise(10, "first"),
                createDelayedPromise(20, "second"),
                createDelayedPromise(15, "third"),
            ];

            const result = await promiseAllWithCancellation(promises, cancellationToken);
            expect(result).to.deep.equal(["first", "second", "third"]);
            expect(cancellationToken.isCancelled()).to.be.false;
        });

        it("should reject immediately if cancellation token is already cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            cancellationToken.cancel("Pre-cancelled");

            const promises = [createDelayedPromise(100, "first"), createDelayedPromise(200, "second")];

            try {
                await promiseAllWithCancellation(promises, cancellationToken);
                assert.fail("Expected promise to be rejected due to pre-cancelled token");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
            }
        });

        it("should reject when cancellation token is cancelled during execution", async () => {
            const cancellationToken = createTestCancellationToken();
            const promises = [
                createDelayedPromise(100, "first"),
                createDelayedPromise(200, "second"),
                createDelayedPromise(300, "third"),
            ];

            // Cancel after 50ms
            setTimeout(() => {
                cancellationToken.cancel("Cancelled during execution");
            }, 50);

            try {
                await promiseAllWithCancellation(promises, cancellationToken);
                assert.fail("Expected promise to be rejected due to cancellation");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
            }
        });

        it("should handle promise rejections normally when not cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            const promises = [
                createDelayedPromise(10, "first"),
                createDelayedRejectingPromise(20, "Test error"),
                createDelayedPromise(15, "third"),
            ];

            try {
                await promiseAllWithCancellation(promises, cancellationToken);
                assert.fail("Expected promise to be rejected due to promise rejection");
            } catch (error: any) {
                expect(error.message).to.equal("Test error");
            }
        });
    });

    describe("processSequentiallyWithCancellation", () => {
        it("should process all items sequentially when no cancellation token is provided", async () => {
            const items = ["a", "b", "c"];
            const processor = async (item: string) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return item.toUpperCase();
            };

            const result = await processSequentiallyWithCancellation(items, processor);
            expect(result).to.deep.equal(["A", "B", "C"]);
        });

        it("should process all items when cancellation token is not cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            const items = ["a", "b", "c"];
            const processor = async (item: string) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return item.toUpperCase();
            };

            const result = await processSequentiallyWithCancellation(items, processor, cancellationToken);
            expect(result).to.deep.equal(["A", "B", "C"]);
            expect(cancellationToken.isCancelled()).to.be.false;
        });

        it("should stop processing when cancellation token is cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            const items = ["a", "b", "c", "d", "e"];
            const processedItems: string[] = [];

            const processor = async (item: string) => {
                processedItems.push(item);
                await new Promise(resolve => setTimeout(resolve, 20));
                return item.toUpperCase();
            };

            // Cancel after processing should have started
            setTimeout(() => {
                cancellationToken.cancel("Cancelled during processing");
            }, 35); // Should allow first item and start of second

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be cancelled");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
                // Should have processed at least the first item, but not all
                expect(processedItems.length).to.be.greaterThan(0);
                expect(processedItems.length).to.be.lessThan(items.length);
            }
        });

        it("should reject immediately if cancellation token is already cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            cancellationToken.cancel("Pre-cancelled");

            const items = ["a", "b", "c"];
            const processor = async (item: string) => item.toUpperCase();

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be rejected due to pre-cancelled token");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
            }
        });

        it("should handle empty arrays", async () => {
            const cancellationToken = createTestCancellationToken();
            const items: string[] = [];
            const processor = async (item: string) => item.toUpperCase();

            const result = await processSequentiallyWithCancellation(items, processor, cancellationToken);
            expect(result).to.deep.equal([]);
        });

        it("should handle processor errors normally when not cancelled", async () => {
            const cancellationToken = createTestCancellationToken();
            const items = ["a", "b", "c"];
            const processor = async (item: string) => {
                if (item === "b") {
                    throw new Error("Test processor error");
                }
                return item.toUpperCase();
            };

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be rejected due to processor error");
            } catch (error: any) {
                expect(error.message).to.equal("Test processor error");
            }
        });

        it("should check cancellation before each item", async () => {
            const cancellationToken = createTestCancellationToken();
            const items = ["a", "b", "c"];
            let processorCallCount = 0;

            const processor = async (item: string) => {
                processorCallCount++;
                return item.toUpperCase();
            };

            // Cancel before any processing
            cancellationToken.cancel("Pre-cancelled");

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be cancelled");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
                expect(processorCallCount).to.equal(0, "Processor should not be called when pre-cancelled");
            }
        });
    });

    describe("cancellation timing behavior", () => {
        it("should demonstrate different cancellation points in sequential processing", async () => {
            const cancellationToken = createTestCancellationToken();
            const items = [1, 2, 3, 4, 5];
            const processedItems: number[] = [];

            const processor = async (item: number) => {
                processedItems.push(item);
                // Each item takes 30ms to process
                await new Promise(resolve => setTimeout(resolve, 30));
                return item * 2;
            };

            // Cancel after 75ms (should process ~2-3 items)
            setTimeout(() => {
                cancellationToken.cancel("Timed cancellation");
            }, 75);

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be cancelled");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
                console.log(
                    `Processed ${processedItems.length} items before cancellation: [${processedItems.join(", ")}]`,
                );

                // Should have processed some but not all items
                expect(processedItems.length).to.be.greaterThan(0);
                expect(processedItems.length).to.be.lessThan(items.length);

                // Should have processed items in order
                for (let i = 0; i < processedItems.length; i++) {
                    expect(processedItems[i]).to.equal(i + 1);
                }
            }
        });
    });
});
