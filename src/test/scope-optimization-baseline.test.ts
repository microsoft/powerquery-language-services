// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { expect } from "chai";

import * as PQLS from "../powerquery-language-services";
import {
    NoOpTraceManagerInstance,
    TraceManager,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { TestConstants, TestUtils } from ".";
import { PerformanceTraceManager } from "./performanceTraceManager";
import { TypeStrategy } from "../powerquery-language-services";

interface PerformanceBaseline {
    readonly documentSize: number;
    readonly typeStrategy: "Extended" | "Primitive";
    readonly validationTimeMs: number;
    readonly diagnosticsCount: number;
    readonly diagnosticsHash: string;
    readonly scopeOperations?: number;
    readonly tracingEnabled: boolean;
}

/**
 * Creates validation settings for baseline testing with StandardLibrary included
 */
function createBaseValidationSettings(traceManager: TraceManager): PQLS.ValidationSettings {
    return {
        ...TestConstants.StandardLibraryValidateAllSettings,
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: false,
        checkUnknownIdentifiers: true,
        library: TestConstants.StandardLibrary, // REQUIRED: Prevents Table.AddColumn, etc. from being unknown
        traceManager, // Pass the same traceManager to validation settings
    };
}

/**
 * Creates a simple hash of diagnostic messages for regression detection
 */
function createDiagnosticsHash(diagnostics: ReadonlyArray<PQLS.Diagnostic>): string {
    const messages: string = diagnostics
        .map((d: PQLS.Diagnostic) => `${d.code}:${d.message}`)
        .sort()
        .join("|");

    // Simple hash function for basic regression detection
    let hash: number = 0;

    for (let i: number = 0; i < messages.length; i += 1) {
        const char: number = messages.charCodeAt(i);

        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16);
}

/**
 * Measures validation performance with detailed tracing
 */
async function measureValidationPerformance(
    documentContent: string,
    typeStrategy: TypeStrategy,
): Promise<PerformanceBaseline> {
    const performanceTracer: PerformanceTraceManager = new PerformanceTraceManager();

    const analysisSettings: PQLS.AnalysisSettings = {
        ...TestConstants.StandardLibraryAnalysisSettings,
        inspectionSettings: {
            ...TestConstants.StandardLibraryInspectionSettings,
            traceManager: performanceTracer, // Use performance tracer
            typeStrategy,
        },
    };

    const validationSettings: PQLS.ValidationSettings = createBaseValidationSettings(performanceTracer);

    // High-precision timing
    const startTime: number = Date.now();

    const diagnostics: ReadonlyArray<PQLS.Diagnostic> = await TestUtils.assertValidateDiagnostics({
        text: documentContent,
        analysisSettings,
        validationSettings,
    });

    const endTime: number = Date.now();
    const durationMs: number = endTime - startTime;

    // Get detailed performance report
    const scopeSummary: any = performanceTracer.getScopeInspectionSummary();
    const allOps: ReadonlyArray<any> = performanceTracer.getAllOperations();
    const inspectionOps: ReadonlyArray<any> = performanceTracer.getInspectionOperations();

    console.log(`DEBUG: Total traced operations: ${allOps.length}`);
    console.log(`DEBUG: Inspection operations: ${inspectionOps.length}`);
    console.log(`DEBUG: Scope inspection operations: ${scopeSummary.totalOperations}`);

    if (allOps.length > 0) {
        const sampleOps: ReadonlyArray<any> = allOps.slice(0, 5);

        console.log("DEBUG: Sample operations:");

        sampleOps.forEach((op: any) => {
            console.log(`  ${op.name} (${op.duration}ms)`);
        });

        // Show unique phases to understand what's being traced
        const uniquePhases: Set<string> = new Set(allOps.map((op: any) => op.phase));
        const uniqueNames: Set<string> = new Set(allOps.slice(0, 20).map((op: any) => op.name));

        console.log(`DEBUG: Unique phases: ${Array.from(uniquePhases).join(", ")}`);
        console.log(`DEBUG: Sample operation names: ${Array.from(uniqueNames).join(", ")}`);
    }

    return {
        documentSize: documentContent.length,
        typeStrategy: typeStrategy === TypeStrategy.Extended ? "Extended" : "Primitive",
        validationTimeMs: durationMs,
        diagnosticsCount: diagnostics.length,
        diagnosticsHash: createDiagnosticsHash(diagnostics),
        scopeOperations: scopeSummary.totalOperations,
        tracingEnabled: true,
    };
}

/**
 * Measures validation performance without tracing (production-like scenario)
 */
async function measureValidationPerformanceNoTracing(
    documentContent: string,
    typeStrategy: TypeStrategy,
): Promise<PerformanceBaseline> {
    const analysisSettings: PQLS.AnalysisSettings = {
        ...TestConstants.StandardLibraryAnalysisSettings,
        inspectionSettings: {
            ...TestConstants.StandardLibraryInspectionSettings,
            traceManager: NoOpTraceManagerInstance, // Use no-op tracer for production-like performance
            typeStrategy,
        },
    };

    const validationSettings: PQLS.ValidationSettings = createBaseValidationSettings(NoOpTraceManagerInstance);

    // High-precision timing
    const startTime: number = Date.now();

    const diagnostics: ReadonlyArray<PQLS.Diagnostic> = await TestUtils.assertValidateDiagnostics({
        text: documentContent,
        analysisSettings,
        validationSettings,
    });

    const endTime: number = Date.now();
    const durationMs: number = endTime - startTime;

    console.log(`DEBUG: No tracing mode - only timing measurement available`);

    return {
        documentSize: documentContent.length,
        typeStrategy: typeStrategy === TypeStrategy.Extended ? "Extended" : "Primitive",
        validationTimeMs: durationMs,
        diagnosticsCount: diagnostics.length,
        diagnosticsHash: createDiagnosticsHash(diagnostics),
        scopeOperations: undefined, // No tracing means no operation counts available
        tracingEnabled: false,
    };
}

describe("Performance Baseline Tests", () => {
    // Read Kusto.pq file content for testing
    const kustoContent: string = TestUtils.readFile("Kusto.pq");

    it("should measure Kusto.pq validation performance with Extended TypeStrategy", async () => {
        console.log("\\n=== Kusto.pq Performance Baseline (Extended) ===");

        const baseline: PerformanceBaseline = await measureValidationPerformance(kustoContent, TypeStrategy.Extended);

        console.log(`Document size: ${baseline.documentSize} characters`);
        console.log(`Validation time: ${baseline.validationTimeMs.toFixed(2)}ms`);
        console.log(`Diagnostics count: ${baseline.diagnosticsCount}`);
        console.log(`Diagnostics hash: ${baseline.diagnosticsHash}`);
        console.log(`Scope operations: ${baseline.scopeOperations}`);

        // Store baseline for future comparisons
        expect(baseline.validationTimeMs).to.be.greaterThan(0);
        expect(baseline.diagnosticsCount).to.be.greaterThanOrEqual(0);

        // Log warning if validation takes extremely long
        if (baseline.validationTimeMs > 60000) {
            console.warn(
                `⚠️  Validation took ${(baseline.validationTimeMs / 1000).toFixed(1)}s - this is the performance issue we need to fix!`,
            );
        }
    }).timeout(120000); // 2 minutes timeout for large file validation

    it("should measure Kusto.pq validation performance with Primitive TypeStrategy", async () => {
        console.log("\\n=== Kusto.pq Performance Baseline (Primitive) ===");

        const baseline: PerformanceBaseline = await measureValidationPerformance(kustoContent, TypeStrategy.Primitive);

        console.log(`Document size: ${baseline.documentSize} characters`);
        console.log(`Validation time: ${baseline.validationTimeMs.toFixed(2)}ms`);
        console.log(`Diagnostics count: ${baseline.diagnosticsCount}`);
        console.log(`Diagnostics hash: ${baseline.diagnosticsHash}`);
        console.log(`Scope operations: ${baseline.scopeOperations}`);

        // Store baseline for future comparisons
        expect(baseline.validationTimeMs).to.be.greaterThan(0);
        expect(baseline.diagnosticsCount).to.be.greaterThanOrEqual(0);

        // Primitive strategy should generally be faster
        console.log("Note: Primitive TypeStrategy should generally be faster than Extended");
    }).timeout(120000); // 2 minutes timeout for large file validation

    it("should test medium complexity document performance", async () => {
        console.log("\\n=== Medium Complexity Document Performance ===");

        // Create a synthetic medium complexity document
        const mediumDocument: string = `
        let
            // Simulate a medium complexity PowerQuery document
            Source = Table.FromRows({
                {"Name", "Value", "Category"},
                {"Item1", 100, "A"},
                {"Item2", 200, "B"},
                {"Item3", 300, "A"}
            }),
            
            AddedIndex = Table.AddIndexColumn(Source, "Index", 0, 1),
            
            GroupedData = Table.Group(AddedIndex, {"Category"}, {
                {"Count", each Table.RowCount(_), type number},
                {"Sum", each List.Sum([Value]), type number}
            }),
            
            CombinedResult = Table.NestedJoin(
                AddedIndex, {"Category"}, 
                GroupedData, {"Category"}, 
                "GroupData", 
                JoinKind.LeftOuter
            ),
            
            ExpandedResult = Table.ExpandTableColumn(
                CombinedResult, "GroupData", {"Count", "Sum"}, {"GroupCount", "GroupSum"}
            ),
            
            FinalResult = Table.AddColumn(
                ExpandedResult, 
                "Percentage", 
                each [Value] / [GroupSum] * 100, 
                type number
            )
        in
            FinalResult
        `;

        const baseline: PerformanceBaseline = await measureValidationPerformance(mediumDocument, TypeStrategy.Extended);

        console.log(`Document size: ${baseline.documentSize} characters`);
        console.log(`Validation time: ${baseline.validationTimeMs.toFixed(2)}ms`);
        console.log(`Diagnostics count: ${baseline.diagnosticsCount}`);
        console.log(`Scope operations: ${baseline.scopeOperations}`);

        // Medium documents should validate relatively quickly
        expect(baseline.validationTimeMs).to.be.lessThan(5000); // Should be under 5 seconds
    });

    it("should test small document performance for regression detection", async () => {
        console.log("\\n=== Small Document Performance ===");

        const smallDocument: string = `
        let
            Source = 42,
            Result = Source + 1
        in
            Result
        `;

        const baseline: PerformanceBaseline = await measureValidationPerformance(smallDocument, TypeStrategy.Extended);

        console.log(`Document size: ${baseline.documentSize} characters`);
        console.log(`Validation time: ${baseline.validationTimeMs.toFixed(2)}ms`);
        console.log(`Diagnostics count: ${baseline.diagnosticsCount}`);
        console.log(`Scope operations: ${baseline.scopeOperations}`);

        // Small documents should validate very quickly
        expect(baseline.validationTimeMs).to.be.lessThan(1000); // Should be under 1 second
        expect(baseline.diagnosticsCount).to.equal(0); // Should have no errors
    });

    // === NO TRACING TESTS (Production-like Performance) ===

    it("should measure Kusto.pq validation performance with Extended TypeStrategy (No Tracing)", async () => {
        console.log("\\n=== Kusto.pq Performance Baseline (Extended, No Tracing) ===");

        const baseline: PerformanceBaseline = await measureValidationPerformanceNoTracing(
            kustoContent,
            TypeStrategy.Extended,
        );

        console.log(`Document size: ${baseline.documentSize} characters`);
        console.log(`Validation time: ${baseline.validationTimeMs.toFixed(2)}ms`);
        console.log(`Diagnostics count: ${baseline.diagnosticsCount}`);
        console.log(`Diagnostics hash: ${baseline.diagnosticsHash}`);
        console.log(`Tracing enabled: ${baseline.tracingEnabled}`);
        console.log(`Scope operations: N/A (no tracing)`);

        // Store baseline for future comparisons
        expect(baseline.validationTimeMs).to.be.greaterThan(0);
        expect(baseline.diagnosticsCount).to.be.greaterThanOrEqual(0);
        expect(baseline.tracingEnabled).to.be.false;
        expect(baseline.scopeOperations).to.be.undefined;

        // Log comparison note
        console.log("📊 This represents production-like performance without tracing overhead");
    }).timeout(120000); // 2 minutes timeout for large file validation

    it("should measure Kusto.pq validation performance with Primitive TypeStrategy (No Tracing)", async () => {
        console.log("\\n=== Kusto.pq Performance Baseline (Primitive, No Tracing) ===");

        const baseline: PerformanceBaseline = await measureValidationPerformanceNoTracing(
            kustoContent,
            TypeStrategy.Primitive,
        );

        console.log(`Document size: ${baseline.documentSize} characters`);
        console.log(`Validation time: ${baseline.validationTimeMs.toFixed(2)}ms`);
        console.log(`Diagnostics count: ${baseline.diagnosticsCount}`);
        console.log(`Diagnostics hash: ${baseline.diagnosticsHash}`);
        console.log(`Tracing enabled: ${baseline.tracingEnabled}`);
        console.log(`Scope operations: N/A (no tracing)`);

        // Store baseline for future comparisons
        expect(baseline.validationTimeMs).to.be.greaterThan(0);
        expect(baseline.diagnosticsCount).to.be.greaterThanOrEqual(0);
        expect(baseline.tracingEnabled).to.be.false;
        expect(baseline.scopeOperations).to.be.undefined;

        // Primitive strategy should generally be faster
        console.log("Note: Primitive TypeStrategy should generally be faster than Extended");
        console.log("📊 This represents production-like performance without tracing overhead");
    }).timeout(120000); // 2 minutes timeout for large file validation
});
