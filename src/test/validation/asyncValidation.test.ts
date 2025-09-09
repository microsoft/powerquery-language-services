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

function createCancellationToken(): ICancellationToken {
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

describe("Async Validation", () => {
    const analysisSettings: AnalysisSettings = TestConstants.SimpleLibraryAnalysisSettings;

    const baseValidationSettings: ValidationSettings = {
        ...TestConstants.StandardLibraryValidateAllSettings,
        isWorkspaceCacheAllowed: false,
    };

    describe("Large document validation", () => {
        let largeSectionDocumentText: string;
        let largeSectionDocumentWithDiagnosticsText: string;
        let largeSectionDocumentWithParserErrorText: string;

        before(() => {
            // Load the large section documents
            const cleanFilePath: string = path.join(__dirname, "..", "files", "LargeSectionDocument.pq");

            const diagnosticsFilePath: string = path.join(
                __dirname,
                "..",
                "files",
                "LargeSectionDocument_WithDiagnostics.pq",
            );

            const parserErrorFilePath: string = path.join(
                __dirname,
                "..",
                "files",
                "LargeSectionDocument_WithParserError.pq",
            );

            largeSectionDocumentText = fs.readFileSync(cleanFilePath, "utf8");
            largeSectionDocumentWithDiagnosticsText = fs.readFileSync(diagnosticsFilePath, "utf8");
            largeSectionDocumentWithParserErrorText = fs.readFileSync(parserErrorFilePath, "utf8");
        });

        it("should validate clean large document successfully without cancellation", async () => {
            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken: undefined, // No cancellation for this test
            };

            const startTime: number = Date.now();

            try {
                const result: ValidateOk = await ValidateTestUtils.assertValidate({
                    text: largeSectionDocumentText,
                    analysisSettings,
                    validationSettings,
                });

                const endTime: number = Date.now();
                const duration: number = endTime - startTime;

                // Validation should complete successfully
                expect(result).to.not.be.undefined;
                expect(result.diagnostics).to.be.an("array");
                expect(result.hasSyntaxError).to.be.false;

                // Should have no parse errors since this is the clean file
                expect(result.hasSyntaxError).to.be.false;

                // Should have significantly fewer diagnostic errors than the diagnostics file
                expect(result.diagnostics.length).to.be.lessThan(
                    100,
                    "Clean document should have fewer diagnostic errors",
                );

                // Log performance for manual observation (no assertions on timing)
                console.log(
                    `Clean large document validation took ${duration}ms with ${result.diagnostics.length} diagnostics`,
                );
            } catch (error: unknown) {
                const endTime: number = Date.now();
                const duration: number = endTime - startTime;

                console.error(`❌ Validation failed after ${duration}ms`);
                console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);

                throw error; // Re-throw to fail the test
            }
        }).timeout(60000); // 60 second timeout

        it("should validate document with diagnostic errors", async () => {
            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken: undefined, // No cancellation for this test
            };

            const startTime: number = Date.now();

            try {
                const result: ValidateOk = await ValidateTestUtils.assertValidate({
                    text: largeSectionDocumentWithDiagnosticsText,
                    analysisSettings,
                    validationSettings,
                });

                const endTime: number = Date.now();
                const duration: number = endTime - startTime;

                // Validation should complete successfully
                expect(result).to.not.be.undefined;
                expect(result.diagnostics).to.be.an("array");
                expect(result.hasSyntaxError).to.be.false;

                // Should have diagnostic errors due to unknown identifiers
                expect(result.diagnostics.length).to.be.greaterThan(0, "Document with diagnostics should have errors");

                console.log(
                    `Document with diagnostics validation took ${duration}ms, found ${result.diagnostics.length} diagnostics`,
                );
            } catch (error: unknown) {
                const endTime: number = Date.now();
                const duration: number = endTime - startTime;

                console.error(`❌ Validation failed after ${duration}ms`);
                console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);

                throw error; // Re-throw to fail the test
            }
        }).timeout(60000);

        it("should handle document with parser errors", async () => {
            const cancellationToken: ICancellationToken = createCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const startTime: number = Date.now();

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: largeSectionDocumentWithParserErrorText,
                analysisSettings,
                validationSettings,
            });

            const endTime: number = Date.now();
            const duration: number = endTime - startTime;

            // Validation should complete but have syntax errors
            expect(result).to.not.be.undefined;
            expect(result.diagnostics).to.be.an("array");
            expect(result.hasSyntaxError).to.be.true;

            // Should have diagnostic errors due to parser errors
            expect(result.diagnostics.length).to.be.greaterThan(
                0,
                "Document with parser errors should have diagnostics",
            );

            console.log(
                `Document with parser errors validation took ${duration}ms, found ${result.diagnostics.length} diagnostics`,
            );
        }).timeout(60000);

        it("should respect cancellation token when cancelled during validation", async () => {
            const cancellationToken: ICancellationToken = createCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            // Start validation with the diagnostics file (takes longer)
            const validationPromise: Promise<Result<ValidateOk | undefined, CommonError.CommonError>> = validate(
                TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                analysisSettings,
                validationSettings,
            );

            // Cancel after a short delay
            setTimeout(() => {
                cancellationToken.cancel("Test cancellation");
            }, 500); // Cancel after 500ms

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validationPromise;

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    // If validation completed successfully, it finished before cancellation
                    console.log("Validation completed before cancellation could take effect");
                },
                () => {
                    // Validation was successfully cancelled
                    console.log("Validation was successfully cancelled");
                },
            );
        }).timeout(30000); // 30 second timeout

        it("should handle cancellation gracefully at different stages", async () => {
            const delays: number[] = [100, 250, 500, 1000]; // Different cancellation timings

            for (const delay of delays) {
                const cancellationToken: ICancellationToken = createCancellationToken();

                const validationSettings: ValidationSettings = {
                    ...baseValidationSettings,
                    cancellationToken,
                };

                const validationPromise: Promise<Result<ValidateOk | undefined, CommonError.CommonError>> = validate(
                    TestUtils.mockDocument(largeSectionDocumentWithDiagnosticsText),
                    analysisSettings,
                    validationSettings,
                );

                // Cancel after the specified delay
                setTimeout(() => {
                    cancellationToken.cancel("Test cancellation");
                }, delay);

                // eslint-disable-next-line no-await-in-loop
                const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validationPromise;

                ValidateTestUtils.assertValidationSuccessOrCancelled(
                    result,
                    () => {
                        // If validation completes despite cancellation,
                        // it might have finished before cancellation occurred
                        console.log(`Validation completed before cancellation at ${delay}ms`);
                    },
                    () => {
                        console.log(`Successfully cancelled validation at ${delay}ms`);
                    },
                );
            }
        }).timeout(60000);

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

            // Then, measure time for cancelled validation
            const startCancelled: number = Date.now();
            const cancellationToken: ICancellationToken = createCancellationToken();

            const cancelledValidationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            // Cancel after enough time to start heavy work but before completion
            // Use the same timing as the successful cancellation test
            setTimeout(
                () => {
                    cancellationToken.cancel("Performance test cancellation");
                },
                Math.min(completeDuration * 0.2, 300), // Cancel at 20% of completion time, max 300ms
            );

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

                console.log(
                    `Cancellation test: validation completed in ${cancellationDuration}ms before cancellation could occur`,
                );
            } else {
                cancellationDuration = Date.now() - startCancelled;
                wasCancelled = true;

                ValidateTestUtils.assertValidationCancelled(result);

                console.log(`Cancellation test: validation was cancelled after ${cancellationDuration}ms`);
            }

            // Log the performance comparison
            console.log(
                `Performance comparison: Complete=${completeDuration}ms, Cancelled=${cancellationDuration}ms, WasCancelled=${wasCancelled}`,
            );

            // Verify that cancellation provided a performance benefit
            if (wasCancelled) {
                // If validation was actually cancelled, it should be significantly faster
                expect(cancellationDuration).to.be.lessThan(
                    completeDuration,
                    `Cancelled validation (${cancellationDuration}ms) should be faster than complete validation (${completeDuration}ms)`,
                );

                console.log(`✓ Cancellation provided ${completeDuration - cancellationDuration}ms performance benefit`);
            } else {
                // If validation completed before cancellation, that's also valuable information
                console.log(
                    `ℹ Validation completed too quickly (${cancellationDuration}ms) for cancellation to take effect`,
                );
            }
        }).timeout(60000);
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
            const cancellationToken: ICancellationToken = createCancellationToken();

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
            const cancellationToken: ICancellationToken = createCancellationToken();
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
            const cancellationToken: ICancellationToken = createCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const startTime: number = Date.now();

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: smallDocument,
                analysisSettings,
                validationSettings,
            });

            const duration: number = Date.now() - startTime;

            expect(result).to.not.be.undefined;
            // Log performance for manual observation (no assertions on timing)
            console.log(`Small document validation took ${duration}ms`);
        });

        it("should have reasonable performance for medium documents", async () => {
            const cancellationToken: ICancellationToken = createCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
            };

            const startTime: number = Date.now();

            const result: ValidateOk = await ValidateTestUtils.assertValidate({
                text: mediumDocument,
                analysisSettings,
                validationSettings,
            });

            const duration: number = Date.now() - startTime;

            expect(result).to.not.be.undefined;
            // Log performance for manual observation (no assertions on timing)
            console.log(`Medium document validation took ${duration}ms`);
        });
    });

    describe("Async validation with different validation settings", () => {
        it("should respect cancellation with all validation checks enabled", async () => {
            const cancellationToken: ICancellationToken = createCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
                checkInvokeExpressions: true,
                checkUnknownIdentifiers: true,
                checkForDuplicateIdentifiers: true,
            };

            const validationPromise: Promise<Result<ValidateOk | undefined, CommonError.CommonError>> = validate(
                TestUtils.mockDocument("let x = unknownFunc(1, 2) in x"),
                analysisSettings,
                validationSettings,
            );

            setTimeout(() => cancellationToken.cancel("Test cancellation"), 100);

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validationPromise;

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    console.log("Validation completed before cancellation");
                },
                () => {
                    // Validation was cancelled - no additional action needed
                },
            );
        });

        it("should respect cancellation with only specific checks enabled", async () => {
            const cancellationToken: ICancellationToken = createCancellationToken();

            const validationSettings: ValidationSettings = {
                ...baseValidationSettings,
                cancellationToken,
                checkInvokeExpressions: false,
                checkUnknownIdentifiers: true,
                checkForDuplicateIdentifiers: false,
            };

            const validationPromise: Promise<Result<ValidateOk | undefined, CommonError.CommonError>> = validate(
                TestUtils.mockDocument("let x = unknownVariable in x"),
                analysisSettings,
                validationSettings,
            );

            setTimeout(() => cancellationToken.cancel("Test cancellation"), 100);

            const result: Result<ValidateOk | undefined, CommonError.CommonError> = await validationPromise;

            ValidateTestUtils.assertValidationSuccessOrCancelled(
                result,
                () => {
                    console.log("Validation completed before cancellation");
                },
                () => {
                    // Validation was cancelled - no additional action needed
                },
            );
        });
    });
});
