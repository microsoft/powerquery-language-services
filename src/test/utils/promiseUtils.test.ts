// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";
import { ICancellationToken } from "@microsoft/powerquery-parser";

import { processSequentiallyWithCancellation } from "../../powerquery-language-services/promiseUtils";

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

describe("Promise Utils", () => {
    describe("processSequentiallyWithCancellation", () => {
        it("should process all items sequentially when no cancellation token is provided", async () => {
            const items: string[] = ["a", "b", "c"];

            const processor: (item: string) => Promise<string> = async (item: string): Promise<string> => {
                await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, 10));

                return item.toUpperCase();
            };

            const result: string[] = await processSequentiallyWithCancellation(items, processor);
            expect(result).to.deep.equal(["A", "B", "C"]);
        });

        it("should process all items when cancellation token is not cancelled", async () => {
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            const items: string[] = ["a", "b", "c"];

            const processor: (item: string) => Promise<string> = async (item: string): Promise<string> => {
                await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, 10));

                return item.toUpperCase();
            };

            const result: string[] = await processSequentiallyWithCancellation(items, processor, cancellationToken);
            expect(result).to.deep.equal(["A", "B", "C"]);
            expect(cancellationToken.isCancelled()).to.be.false;
        });

        it("should stop processing when cancellation token is cancelled", async () => {
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            const items: string[] = ["a", "b", "c", "d", "e"];
            const processedItems: string[] = [];

            const processor: (item: string) => Promise<string> = async (item: string): Promise<string> => {
                processedItems.push(item);
                await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, 20));

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
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            cancellationToken.cancel("Pre-cancelled");

            const items: string[] = ["a", "b", "c"];

            const processor: (item: string) => Promise<string> = (item: string): Promise<string> =>
                Promise.resolve(item.toUpperCase());

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be rejected due to pre-cancelled token");
            } catch (error: any) {
                expect(error.message).to.contain("cancelled");
            }
        });

        it("should handle empty arrays", async () => {
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            const items: string[] = [];

            const processor: (item: string) => Promise<string> = (item: string): Promise<string> =>
                Promise.resolve(item.toUpperCase());

            const result: string[] = await processSequentiallyWithCancellation(items, processor, cancellationToken);
            expect(result).to.deep.equal([]);
        });

        it("should handle processor errors normally when not cancelled", async () => {
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            const items: string[] = ["a", "b", "c"];

            const processor: (item: string) => Promise<string> = (item: string): Promise<string> => {
                if (item === "b") {
                    throw new Error("Test processor error");
                }

                return Promise.resolve(item.toUpperCase());
            };

            try {
                await processSequentiallyWithCancellation(items, processor, cancellationToken);
                assert.fail("Expected processing to be rejected due to processor error");
            } catch (error: any) {
                expect(error.message).to.equal("Test processor error");
            }
        });

        it("should check cancellation before each item", async () => {
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            const items: string[] = ["a", "b", "c"];
            let processorCallCount: number = 0;

            const processor: (item: string) => Promise<string> = (item: string): Promise<string> => {
                processorCallCount += 1;

                return Promise.resolve(item.toUpperCase());
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
            const cancellationToken: ICancellationToken & { cancel: (reason: string) => void } =
                createTestCancellationToken();

            const items: number[] = [1, 2, 3, 4, 5];
            const processedItems: number[] = [];

            const processor: (item: number) => Promise<number> = async (item: number): Promise<number> => {
                processedItems.push(item);
                // Each item takes 30ms to process
                await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, 30));

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
                for (let i: number = 0; i < processedItems.length; i = i + 1) {
                    expect(processedItems[i]).to.equal(i + 1);
                }
            }
        });
    });
});
