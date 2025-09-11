// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

import { CommonError, ICancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";

import * as ValidateTestUtils from "../testUtils/validationTestUtils";

import { AnalysisSettings, validate, ValidateOk, ValidationSettings } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";

const TEST_TIMEOUT_MS: number = 60000;

describe("Async Validation", () => {
    const analysisSettings: AnalysisSettings = TestConstants.SimpleLibraryAnalysisSettings;

    const baseValidationSettings: ValidationSettings = {
        ...TestConstants.StandardLibraryValidateAllSettings,
        isWorkspaceCacheAllowed: false,
    };

    let largeSectionDocumentWithDiagnosticsText: string;

    before(() => {
        // Load the large section document with diagnostics for all tests
        const diagnosticsFilePath: string = path.join(
            __dirname,
            "..",
            "files",
            "LargeSectionDocument_WithDiagnostics.pq",
        );

        largeSectionDocumentWithDiagnosticsText = fs.readFileSync(diagnosticsFilePath, "utf8");
    });

    describe("Large document validation", () => {
        it("should validate document with diagnostic errors without cancellation", async () => {
            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken: undefined, // No cancellation for this test
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: largeSectionDocumentWithDiagnosticsText,
                analysisSettings,
                validationSettings,
            });

            // Validation should complete successfully
            expect(result).to.not.be.undefined;
            expect(result.diagnostics).to.be.an("array");
            expect(result.hasSyntaxError).to.be.false;

            // Should have diagnostic errors due to unknown identifiers
            expect(result.diagnostics.length).to.be.greaterThan(0, "Document with diagnostics should have errors");
        }).timeout(TEST_TIMEOUT_MS);

        it("should respect cancellation token when cancelled after few cancellation checks", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    cancelAfterCount: 3, // Cancel after 3 calls to isCancelled/throwIfCancelled
                    asyncDelayMs: 0, // Immediate cancellation for deterministic testing
                    testId: "Few cancellation checks",
                });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            console.log(`Test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`);

            // This test expects cancellation to occur with immediate cancellation
            ValidateTestUtils.assertValidationCancelled(
                result,
                "Expected validation to be cancelled after 3 cancellation checks with immediate cancellation",
            );
        }).timeout(TEST_TIMEOUT_MS);

        it("should respect cancellation token when cancelled after moderate cancellation checks", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    cancelAfterCount: 100, // Cancel after 100 calls to isCancelled/throwIfCancelled
                    testId: "Moderate cancellation checks",
                });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            console.log(`Test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`);

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    // Validation completed before reaching cancellation threshold
                },
                () => {
                    // Validation was successfully cancelled
                },
            );
        }).timeout(TEST_TIMEOUT_MS);

        it("should respect cancellation token when cancelled after many cancellation checks", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    cancelAfterCount: 1000, // Cancel after 1000 calls to isCancelled/throwIfCancelled
                    testId: "Many cancellation checks",
                });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            console.log(`Test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`);

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    // Validation completed before reaching cancellation threshold
                },
                () => {
                    // Validation was successfully cancelled
                },
            );
        }).timeout(TEST_TIMEOUT_MS);

        it("should handle cancellation gracefully at different thresholds", async () => {
            const thresholds: number[] = [5, 25, 50, 200]; // Different cancellation thresholds

            for (const threshold of thresholds) {
                // Low thresholds should definitely trigger cancellation with synchronous cancellation
                if (threshold <= 25) {
                    const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                        TestUtils.createTestCancellationToken({
                            cancelAfterCount: threshold,
                            asyncDelayMs: undefined, // Synchronous cancellation for deterministic testing
                            testId: `Threshold ${threshold}`,
                        });

                    const validationSettings: ValidationSettings = {
                        ...baseValidationSettings,
                        cancellationToken,
                    };

                    // eslint-disable-next-line no-await-in-loop
                    const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                        TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                        analysisSettings,
                        validationSettings,
                    );

                    console.log(
                        `Threshold ${threshold} test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`,
                    );

                    ValidateTestUtils.assertValidationCancelled(
                        result,
                        `Expected validation to be cancelled with low threshold of ${threshold} calls`,
                    );
                } else {
                    const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                        TestUtils.createTestCancellationToken({
                            cancelAfterCount: threshold,
                            testId: `Threshold ${threshold}`,
                        });

                    const validationSettings: ValidationSettings = {
                        ...baseValidationSettings,
                        cancellationToken,
                    };

                    // eslint-disable-next-line no-await-in-loop
                    const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                        TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                        analysisSettings,
                        validationSettings,
                    );

                    console.log(
                        `Threshold ${threshold} test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`,
                    );

                    // Higher thresholds might complete before cancellation occurs
                    ValidateTestUtils.assertValidationSuccessOrCancelled(
                        result,
                        () => {
                            // Validation completed before reaching cancellation threshold
                        },
                        () => {
                            // Validation was successfully cancelled
                        },
                    );
                }
            }
        }).timeout(TEST_TIMEOUT_MS);

        it("should demonstrate performance benefit of cancellation", async () => {
            // Test that cancelled validation is faster than completed validation

            // First, measure time for completed validation
            const startComplete: number = Date.now();

            const completedValidationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken: undefined, // No cancellation
            };

            await ValidateTestUtils.assertValidate({
                text: largeSectionDocumentWithDiagnosticsText,
                analysisSettings,
                validationSettings: completedValidationSettings,
            });

            const completeDuration: number = Date.now() - startComplete;

            // Then, measure time for cancelled validation with early threshold
            const startCancelled: number = Date.now();

            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    cancelAfterCount: 10, // Cancel after 10 calls
                    asyncDelayMs: 0, // Immediate cancellation for deterministic testing
                    testId: "Performance benefit test",
                });

            const cancelledValidationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            let cancellationDuration: number = 0;
            let wasCancelled: boolean = false;

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                cancelledValidationSettings,
            );

            console.log(`Performance test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`);

            if (ResultUtils.isOk(result)) {
                // This test expects cancellation to occur, so fail if it doesn't
                throw new Error(
                    `Expected validation to be cancelled with threshold of 10 calls, but it completed successfully in ${Date.now() - startCancelled}ms`,
                );
            } else {
                cancellationDuration = Date.now() - startCancelled;
                wasCancelled = true;

                ValidateTestUtils.assertValidationCancelled(result);
            }

            // Verify that cancellation provided a performance benefit
            expect(wasCancelled).to.be.true;

            expect(cancellationDuration).to.be.lessThan(
                completeDuration,
                `Cancelled validation (${cancellationDuration}ms) should be faster than complete validation (${completeDuration}ms)`,
            );
        }).timeout(TEST_TIMEOUT_MS);
    });

    describe("Cancellation token behavior", () => {
        it("should not throw when cancellation token is undefined", async () => {
            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken: undefined,
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: largeSectionDocumentWithDiagnosticsText,
                analysisSettings,
                validationSettings,
            });

            expect(result).to.not.be.undefined;
        });

        it("should not throw when cancellation token is not cancelled", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    testId: "No cancellation test",
                });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: largeSectionDocumentWithDiagnosticsText,
                analysisSettings,
                validationSettings,
            });

            console.log(
                `No cancellation test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`,
            );

            expect(result).to.not.be.undefined;
            expect(cancellationToken.isCancelled()).to.be.false;
        });

        it("should throw immediately when cancellation token is already cancelled", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    testId: "Pre-cancelled test",
                });

            cancellationToken.cancel("Pre-cancelled for testing"); // Cancel before starting

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            console.log(`Pre-cancelled test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`);

            ValidateTestUtils.assertValidationCancelled(
                result,
                "Expected validation to return error due to pre-cancelled token",
            );
        });
    });

    describe("Async validation with different validation settings", () => {
        it("should respect cancellation with all validation checks enabled", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    cancelAfterCount: 5, // Cancel after 5 calls to test early cancellation with all checks
                    asyncDelayMs: 0, // Immediate cancellation for deterministic testing
                    testId: "All validation checks",
                });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
                checkInvokeExpressions: true,
                checkUnknownIdentifiers: true,
                checkForDuplicateIdentifiers: true,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            console.log(
                `All validation checks test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`,
            );

            // This test expects cancellation to occur with a low threshold
            ValidateTestUtils.assertValidationCancelled(
                result,
                "Expected validation to be cancelled after 5 cancellation checks with all validation enabled",
            );
        });

        it("should respect cancellation with only specific checks enabled", async () => {
            const cancellationToken: ICancellationToken & { getCallCount: () => number } =
                TestUtils.createTestCancellationToken({
                    cancelAfterCount: 5, // Cancel after 5 calls to test with fewer validation checks
                    asyncDelayMs: undefined, // Synchronous cancellation for deterministic testing
                    testId: "Specific validation checks",
                });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
                checkInvokeExpressions: false,
                checkUnknownIdentifiers: true,
                checkForDuplicateIdentifiers: false,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            console.log(
                `Specific validation checks test completed - Total cancellation calls: ${cancellationToken.getCallCount()}`,
            );

            // This test expects cancellation to occur with a low threshold
            ValidateTestUtils.assertValidationCancelled(
                result,
                "Expected validation to be cancelled after 5 cancellation checks with specific validation enabled",
            );
        });
    });
});
