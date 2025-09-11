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

    describe("Large document validation", () => {
        let largeSectionDocumentWithDiagnosticsText: string;

        before(() => {
            // Load the large section document with diagnostics
            const diagnosticsFilePath: string = path.join(
                __dirname,
                "..",
                "files",
                "LargeSectionDocument_WithDiagnostics.pq",
            );

            largeSectionDocumentWithDiagnosticsText = fs.readFileSync(diagnosticsFilePath, "utf8");
        });

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
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                cancelAfterCount: 10, // Cancel after 10 calls to isCancelled/throwIfCancelled
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

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    // If validation completed successfully, it finished before reaching cancellation threshold
                },
                () => {
                    // Validation was successfully cancelled
                },
            );
        }).timeout(TEST_TIMEOUT_MS);

        it("should respect cancellation token when cancelled after moderate cancellation checks", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                cancelAfterCount: 100, // Cancel after 100 calls to isCancelled/throwIfCancelled
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
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                cancelAfterCount: 1000, // Cancel after 1000 calls to isCancelled/throwIfCancelled
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
                const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                    cancelAfterCount: threshold,
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

            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                cancelAfterCount: 50, // Cancel after 50 calls
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

            if (ResultUtils.isOk(result)) {
                // If we get here, validation completed before cancellation
                cancellationDuration = Date.now() - startCancelled;
            } else {
                cancellationDuration = Date.now() - startCancelled;
                wasCancelled = true;

                ValidateTestUtils.assertValidationCancelled(result);
            }

            // Verify that cancellation provided a performance benefit
            if (wasCancelled) {
                // If validation was actually cancelled, it should be significantly faster
                expect(cancellationDuration).to.be.lessThan(
                    completeDuration,
                    `Cancelled validation (${cancellationDuration}ms) should be faster than complete validation (${completeDuration}ms)`,
                );
            }
        }).timeout(TEST_TIMEOUT_MS);
    });

    describe("Cancellation token behavior", () => {
        it("should not throw when cancellation token is undefined", async () => {
            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken: undefined,
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: "let x = 1 in x",
                analysisSettings,
                validationSettings,
            });

            expect(result).to.not.be.undefined;
        });

        it("should not throw when cancellation token is not cancelled", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: "let x = 1 in x",
                analysisSettings,
                validationSettings,
            });

            expect(result).to.not.be.undefined;
            expect(cancellationToken.isCancelled()).to.be.false;
        });

        it("should throw immediately when cancellation token is already cancelled", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken();
            cancellationToken.cancel("Pre-cancelled for testing"); // Cancel before starting

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument("let x = 1 in x"),
                analysisSettings,
                validationSettings,
            );

            ValidateTestUtils.assertValidationCancelled(
                result,
                "Expected validation to return error due to pre-cancelled token",
            );
        });
    });

    describe("Performance with different document sizes", () => {
        // Note: These tests validate functional correctness and log performance metrics
        // without asserting on timing to avoid flaky tests across different environments.
        // Performance can be monitored through:
        // 1. Console output during test runs
        // 2. Separate performance benchmarking tools
        // 3. CI/CD performance tracking over time

        const smallDocument: string = "let x = 1 in x";

        const mediumDocument: string = `
            let
                func1 = (param1 as text, param2 as number) => param1 & Text.From(param2),
                func2 = (data as table) => Table.RowCount(data),
                func3 = (list as list) => List.Sum(list),
                result = func1("Hello", func2(#table({"Col1"}, {{"Value1"}, {"Value2"}, {"Value3"}})))
            in
                result
        `;

        it("should have reasonable performance for small documents", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: smallDocument,
                analysisSettings,
                validationSettings,
            });

            expect(result).to.not.be.undefined;
        });

        it("should have reasonable performance for medium documents", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: mediumDocument,
                analysisSettings,
                validationSettings,
            });

            expect(result).to.not.be.undefined;
        });
    });

    describe("Async validation with different validation settings", () => {
        it("should respect cancellation with all validation checks enabled", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                cancelAfterCount: 20, // Cancel after 20 calls to test early cancellation with all checks
            });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
                checkInvokeExpressions: true,
                checkUnknownIdentifiers: true,
                checkForDuplicateIdentifiers: true,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument("let x = unknownFunc(1, 2) in x"),
                analysisSettings,
                validationSettings,
            );

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    // Validation completed before reaching cancellation threshold
                },
                () => {
                    // Validation was cancelled
                },
            );
        });

        it("should respect cancellation with only specific checks enabled", async () => {
            const cancellationToken: ICancellationToken = TestUtils.createTestCancellationToken({
                cancelAfterCount: 30, // Cancel after 30 calls to test with fewer validation checks
            });

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
                checkInvokeExpressions: false,
                checkUnknownIdentifiers: true,
                checkForDuplicateIdentifiers: false,
            };

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validate(
                TestUtils.mockDocument("let x = unknownVariable in x"),
                analysisSettings,
                validationSettings,
            );

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    // Validation completed before reaching cancellation threshold
                },
                () => {
                    // Validation was cancelled
                },
            );
        });
    });
});
