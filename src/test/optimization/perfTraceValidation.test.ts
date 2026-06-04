// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { NoOpCancellationToken, ResultUtils } from "@microsoft/powerquery-parser";
import { ReportTraceManager, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Position } from "vscode-languageserver-types";

import { Analysis, AnalysisSettings, AnalysisUtils, textDocument } from "../../powerquery-language-services";
import { TestConstants } from "..";

// ═══════════════════════════════════════════════════════════════════════════════
// Infrastructure
// ═══════════════════════════════════════════════════════════════════════════════

const DATA_CONNECTORS_ROOT = String.raw`C:\Users\jobolton\Downloads\DataConnectors`;

/** Parsed representation of a single trace line (tab-delimited). */
interface ParsedTrace {
    phase: string;
    task: string;
    id: string;
    correlationId: string;
    elapsedMs: number;
    message: string;
    details: string;
}

function parseTraceLines(lines: string[]): ParsedTrace[] {
    return lines
        .filter((line) => line.trim().length > 0)
        .map((line) => {
            const parts = line.replace(/\r?\n$/, "").split("\t");

            return {
                phase: parts[0] ?? "",
                task: parts[1] ?? "",
                id: parts[2] ?? "",
                correlationId: parts[3] ?? "",
                elapsedMs: parseInt(parts[4] ?? "0", 10),
                message: parts[5] ?? "",
                details: parts[6] ?? "",
            };
        });
}

function createCollectingTraceManager(): {
    traceManager: ReportTraceManager;
    lines: string[];
} {
    const lines: string[] = [];

    const traceManager: ReportTraceManager = new ReportTraceManager((message: string) => {
        lines.push(message);
    });

    return { traceManager, lines };
}

function createTracedSettings(traceManager: ReportTraceManager): AnalysisSettings {
    return {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        traceManager,
        initialCorrelationId: undefined,
    };
}

function loadConnectorFile(relativePath: string): string {
    const fullPath: string = path.join(DATA_CONNECTORS_ROOT, relativePath);

    if (!fs.existsSync(fullPath)) {
        throw new Error(`DataConnector file not found: ${fullPath}`);
    }

    return fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
}

/** Summary statistics for a set of trace lines. */
interface TraceStats {
    totalTraces: number;
    entryCount: number;
    exitCount: number;
    uniquePhases: string[];
    uniqueTasks: string[];
    maxDepth: number;
    totalElapsedMs: number;
    phaseBreakdown: Map<string, { count: number; totalMs: number }>;
}

function computeTraceStats(parsed: ParsedTrace[]): TraceStats {
    const phaseBreakdown: Map<string, { count: number; totalMs: number }> = new Map();
    let maxDepth: number = 0;
    let totalElapsedMs: number = 0;

    const idToCorrelation: Map<string, string> = new Map();

    for (const t of parsed) {
        idToCorrelation.set(t.id, t.correlationId);

        const existing: { count: number; totalMs: number } | undefined = phaseBreakdown.get(t.phase);

        if (existing) {
            existing.count++;
            existing.totalMs += t.elapsedMs;
        } else {
            phaseBreakdown.set(t.phase, { count: 1, totalMs: t.elapsedMs });
        }

        if (t.message === TraceConstant.Exit) {
            totalElapsedMs += t.elapsedMs;
        }
    }

    // Walk correlation chains to find max depth
    for (const t of parsed) {
        let depth: number = 0;
        let currentCorrelation: string = t.correlationId;

        while (currentCorrelation && currentCorrelation !== "" && depth < 100) {
            depth++;
            currentCorrelation = idToCorrelation.get(currentCorrelation) ?? "";
        }

        if (depth > maxDepth) {
            maxDepth = depth;
        }
    }

    const entries: ParsedTrace[] = parsed.filter((t) => t.message === TraceConstant.Entry);
    const exits: ParsedTrace[] = parsed.filter((t) => t.message === TraceConstant.Exit);

    return {
        totalTraces: parsed.length,
        entryCount: entries.length,
        exitCount: exits.length,
        uniquePhases: [...new Set(parsed.map((t) => t.phase))],
        uniqueTasks: [...new Set(parsed.map((t) => t.task))],
        maxDepth,
        totalElapsedMs,
        phaseBreakdown,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

describe("Performance trace validation with DataConnectors", function () {
    // Large files may take time to parse
    this.timeout(60_000);

    // ──────────────────────────────────────────────────────────────────────────
    // Candidate #1: BFS traversal in getDefinition
    // ──────────────────────────────────────────────────────────────────────────

    describe("Candidate #1: BFS traversal (getDefinition)", () => {
        it("exercises deep scope chain in Kusto.pq", async () => {
            const content: string = loadConnectorFile("Extensions/Kusto/Kusto.pq");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("kusto-bfs", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            // Position near a deeply nested identifier reference
            const position: Position = { line: 50, character: 20 };
            const result = await analysis.getDefinition(position, NoOpCancellationToken);
            ResultUtils.assertIsOk(result);
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [BFS] Total traces: ${stats.totalTraces}`);
            console.log(`    [BFS] Max depth: ${stats.maxDepth}`);
            console.log(`    [BFS] Entry/Exit pairs: ${stats.entryCount}`);

            expect(stats.entryCount).to.equal(stats.exitCount, "Entry/Exit mismatch");
            expect(stats.totalTraces).to.be.greaterThan(0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Candidate #2: Folding ranges — 11 chained .concat()
    // ──────────────────────────────────────────────────────────────────────────

    describe("Candidate #2: Folding ranges (chained .concat())", () => {
        it("produces many folding ranges from Kusto.pq (501 if-expressions)", async () => {
            const content: string = loadConnectorFile("Extensions/Kusto/Kusto.pq");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("kusto-fold", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const result = await analysis.getFoldingRanges(NoOpCancellationToken);
            ResultUtils.assertIsOk(result);

            const foldingRanges = result.value;
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [Folding] Total traces: ${stats.totalTraces}`);
            console.log(`    [Folding] Folding ranges returned: ${foldingRanges?.length ?? 0}`);
            console.log(`    [Folding] Unique phases: ${stats.uniquePhases.join(", ")}`);

            expect(foldingRanges?.length ?? 0).to.be.greaterThan(10);
            expect(stats.entryCount).to.equal(stats.exitCount);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Candidate #3: Field access autocomplete — .concat() in union loop
    // ──────────────────────────────────────────────────────────────────────────

    describe("Candidate #3: Field access autocomplete (union .concat())", function () {
        it("exercises record type field resolution in R4-FhirTypes.pqm", async function () {
            this.timeout(300_000);

            const content: string = loadConnectorFile("Certified/Microsoft/Fhir/R4-FhirTypes.pqm");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("fhir-types", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const position: Position = { line: 100, character: 10 };
            const result = await analysis.getAutocompleteItems(position, NoOpCancellationToken);
            ResultUtils.assertIsOk(result);
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [FieldAccess] Total traces: ${stats.totalTraces}`);
            console.log(`    [FieldAccess] Unique phases: ${stats.uniquePhases.join(", ")}`);
            console.log(`    [FieldAccess] Total elapsed (exit sum): ${stats.totalElapsedMs}ms`);

            expect(stats.entryCount).to.equal(stats.exitCount);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Candidate #4 & #7: Leaf search + keyword autocomplete
    // ──────────────────────────────────────────────────────────────────────────

    describe("Candidate #4 & #7: Leaf search + keyword autocomplete", () => {
        it("exercises leaf search on operator-heavy Kusto.pq", async () => {
            const content: string = loadConnectorFile("Extensions/Kusto/Kusto.pq");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("kusto-leaf", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const positions: Position[] = [
                { line: 40, character: 30 },
                { line: 100, character: 15 },
                { line: 200, character: 10 },
            ];

            let totalTraceCount: number = 0;

            for (const position of positions) {
                lines.length = 0;
                const result = await analysis.getAutocompleteItems(position, NoOpCancellationToken);
                ResultUtils.assertIsOk(result);

                const parsed: ParsedTrace[] = parseTraceLines(lines);
                totalTraceCount += parsed.length;
            }

            analysis.dispose();

            console.log(`    [LeafSearch] Total traces across 3 positions: ${totalTraceCount}`);
            expect(totalTraceCount).to.be.greaterThan(0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Candidate #5: Semantic tokens — inline [].includes per binOp
    // ──────────────────────────────────────────────────────────────────────────

    describe("Candidate #5: Semantic tokens (inline [].includes)", () => {
        it("produces semantic tokens for LakeHouse.pq (195 as + 67 is)", async () => {
            const content: string = loadConnectorFile("Certified/Microsoft/LakeHouse/LakeHouse.pq");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("lakehouse-tokens", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const result = await analysis.getPartialSemanticTokens(NoOpCancellationToken);
            ResultUtils.assertIsOk(result);

            const tokens = result.value;
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [SemanticTokens] Total traces: ${stats.totalTraces}`);
            console.log(`    [SemanticTokens] Tokens returned: ${tokens?.length ?? 0}`);
            console.log(`    [SemanticTokens] Total elapsed (exit sum): ${stats.totalElapsedMs}ms`);

            expect(tokens?.length ?? 0).to.be.greaterThan(50);
            expect(stats.entryCount).to.equal(stats.exitCount);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Candidate #8: Type inspection — .map().indexOf(false)
    // ──────────────────────────────────────────────────────────────────────────

    describe("Candidate #8: Type inspection (allForAnyUnion)", () => {
        it("exercises union type resolution via getHover on Kusto.pq", async () => {
            const content: string = loadConnectorFile("Extensions/Kusto/Kusto.pq");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("kusto-type", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const position: Position = { line: 42, character: 5 };
            const result = await analysis.getHover(position, NoOpCancellationToken);
            ResultUtils.assertIsOk(result);
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [TypeInspection] Total traces: ${stats.totalTraces}`);
            console.log(`    [TypeInspection] Max depth: ${stats.maxDepth}`);
            console.log(`    [TypeInspection] Total elapsed (exit sum): ${stats.totalElapsedMs}ms`);

            expect(stats.totalTraces).to.be.greaterThan(0);
            expect(stats.entryCount).to.equal(stats.exitCount);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Stress test: Maximum-size file
    // ──────────────────────────────────────────────────────────────────────────

    describe("Stress test: R4-SearchParameterFoldingPatterns.pqm (143K lines)", function () {
        it("measures trace volume on getFoldingRanges for massive file", async function () {
            this.timeout(300_000);

            const content: string = loadConnectorFile(
                "Certified/Microsoft/Fhir/R4-SearchParameterFoldingPatterns.pqm",
            );

            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("fhir-stress", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const startTime: number = performance.now();
            const result = await analysis.getFoldingRanges(NoOpCancellationToken);
            const wallClockMs: number = performance.now() - startTime;

            ResultUtils.assertIsOk(result);
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [STRESS] Wall-clock time: ${wallClockMs.toFixed(0)}ms`);
            console.log(`    [STRESS] Total trace lines: ${stats.totalTraces}`);
            console.log(`    [STRESS] Entry/Exit pairs: ${stats.entryCount}`);
            console.log(`    [STRESS] Folding ranges: ${result.value?.length ?? 0}`);

            expect(stats.entryCount).to.equal(stats.exitCount, "Entry/Exit mismatch on stress test");
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Comparative: Trace volume scaling across file sizes
    // ──────────────────────────────────────────────────────────────────────────

    describe("Comparative: Trace volume scaling", () => {
        const files: Array<{ name: string; relativePath: string }> = [
            { name: "Snowflake (1,406 lines)", relativePath: "Extensions/Snowflake/Snowflake.m" },
            { name: "Kusto (3,299 lines)", relativePath: "Extensions/Kusto/Kusto.pq" },
            { name: "LakeHouse (3,751 lines)", relativePath: "Certified/Microsoft/LakeHouse/LakeHouse.pq" },
        ];

        const scalingResults: Array<{ name: string; traceCount: number; wallMs: number }> = [];

        for (const file of files) {
            it(`getFoldingRanges on ${file.name}`, async () => {
                const content: string = loadConnectorFile(file.relativePath);
                const { traceManager, lines } = createCollectingTraceManager();
                const settings: AnalysisSettings = createTracedSettings(traceManager);
                const doc = textDocument(`scale-${file.name}`, 1, content);
                const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

                const startTime: number = performance.now();
                const result = await analysis.getFoldingRanges(NoOpCancellationToken);
                const wallMs: number = performance.now() - startTime;
                ResultUtils.assertIsOk(result);
                analysis.dispose();

                const parsed: ParsedTrace[] = parseTraceLines(lines);

                scalingResults.push({ name: file.name, traceCount: parsed.length, wallMs });

                console.log(
                    `    [Scale] ${file.name}: ${parsed.length} traces, ${wallMs.toFixed(0)}ms, ${result.value?.length ?? 0} folds`,
                );

                expect(parsed.filter((t) => t.message === TraceConstant.Entry).length).to.equal(
                    parsed.filter((t) => t.message === TraceConstant.Exit).length,
                );
            });
        }

        after(() => {
            if (scalingResults.length >= 2) {
                console.log("\n    [Scale Summary]");

                for (const r of scalingResults) {
                    console.log(`      ${r.name}: ${r.traceCount} traces (${r.wallMs.toFixed(0)}ms)`);
                }
            }
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Phase breakdown: Which phases dominate?
    // ──────────────────────────────────────────────────────────────────────────

    describe("Phase breakdown analysis", () => {
        it("identifies dominant phases in getHover on LakeHouse.pq", async () => {
            const content: string = loadConnectorFile("Certified/Microsoft/LakeHouse/LakeHouse.pq");
            const { traceManager, lines } = createCollectingTraceManager();
            const settings: AnalysisSettings = createTracedSettings(traceManager);
            const doc = textDocument("lakehouse-phases", 1, content);
            const analysis: Analysis = AnalysisUtils.analysis(doc, settings);

            const position: Position = { line: 1800, character: 20 };
            const result = await analysis.getHover(position, NoOpCancellationToken);
            ResultUtils.assertIsOk(result);
            analysis.dispose();

            const parsed: ParsedTrace[] = parseTraceLines(lines);
            const stats: TraceStats = computeTraceStats(parsed);

            console.log(`    [Phases] Total traces: ${stats.totalTraces}`);
            console.log(`    [Phases] Breakdown:`);

            const sortedPhases: Array<[string, { count: number; totalMs: number }]> = [
                ...stats.phaseBreakdown.entries(),
            ].sort((a, b) => b[1].count - a[1].count);

            for (const [phase, data] of sortedPhases) {
                const pct: string = ((data.count / stats.totalTraces) * 100).toFixed(1);
                console.log(`      ${phase}: ${data.count} (${pct}%) — ${data.totalMs}ms total`);
            }

            expect(sortedPhases.length).to.be.greaterThan(0);
            expect(stats.entryCount).to.equal(stats.exitCount);
        });
    });
});
