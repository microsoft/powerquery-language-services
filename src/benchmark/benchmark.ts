// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultSettings, ResultUtils, Task, TaskUtils } from "@microsoft/powerquery-parser";
import { Buffer } from "node:buffer";
import { cpus } from "node:os";
import { inspect } from "node:util";
import { ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    Analysis,
    AnalysisSettings,
    AnalysisUtils,
    InspectionSettings,
    Library,
    LibrarySymbolUtils,
    TypeStrategy,
    validate,
    ValidationSettings,
} from "../powerquery-language-services";
import { BenchmarkConfig, BenchmarkOperation } from "./config";
import StandardLibrarySymbols from "../test/standard-library-symbols-en-us.json";
import { validateUnknownIdentifiers } from "../powerquery-language-services/validate/validateUnknownIdentifiers";

const Iterations: number = 10;
let documentVersion: number = 0;

export interface PreparedCommand {
    run(): Promise<unknown>;
    dispose(): void;
    readonly hasSyntaxError?: boolean;
}

interface Statistics {
    readonly average: number;
    readonly minimum: number;
    readonly maximum: number;
}

interface MemorySnapshot {
    readonly rss: number;
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
    readonly arrayBuffers: number;
}

interface Sample {
    readonly durationMs: number;
    readonly cpuUserMs: number;
    readonly cpuSystemMs: number;
    readonly memoryBeforeBytes: MemorySnapshot;
    readonly memoryAfterBytes: MemorySnapshot;
    readonly memoryDeltaBytes: MemorySnapshot;
    readonly result: { readonly kind: "value" | "array" | "undefined"; readonly count?: number };
    readonly hasSyntaxError?: boolean;
}

export interface Measurement {
    readonly warmupRuns: number;
    readonly measuredRuns: number;
    readonly durationMs: Statistics;
    readonly cpuUserMs: Statistics;
    readonly cpuSystemMs: Statistics;
    readonly memoryDeltaBytes: Record<keyof MemorySnapshot, Statistics>;
    readonly samples: ReadonlyArray<Sample>;
}

export interface CommandReport {
    readonly path: string;
    readonly fileBytes: number;
    readonly operation: BenchmarkOperation | { readonly kind: "lexParse" };
    readonly status: "ok" | "error";
    readonly measurement?: Measurement;
    readonly error?: string;
}

export interface BenchmarkReport {
    readonly environment: {
        readonly node: string;
        readonly platform: string;
        readonly architecture: string;
        readonly cpu: string | undefined;
        readonly gcBeforeEachRun: boolean;
    };
    readonly library: BenchmarkConfig["library"];
    readonly operationTiming: "fresh-analysis-excluding-lex-parse";
    readonly results: ReadonlyArray<CommandReport>;
}

// Preparation, collection, disposal, and result summarization are outside the measured interval.
export async function measureCommand(prepare: () => Promise<PreparedCommand>): Promise<Measurement> {
    const samples: Sample[] = [];

    for (let iteration: number = -1; iteration < Iterations; iteration += 1) {
        // Each sample must finish before the next is prepared.
        // eslint-disable-next-line no-await-in-loop
        const command: PreparedCommand = await prepare();

        try {
            globalThis.gc?.();

            if (iteration === -1) {
                // eslint-disable-next-line no-await-in-loop
                await command.run();

                continue;
            }

            const memoryBeforeBytes: MemorySnapshot = process.memoryUsage();
            const cpuBefore: ReturnType<typeof process.cpuUsage> = process.cpuUsage();
            const start: number = performance.now();
            // eslint-disable-next-line no-await-in-loop
            const result: unknown = await command.run();
            const durationMs: number = performance.now() - start;
            const cpu: ReturnType<typeof process.cpuUsage> = process.cpuUsage(cpuBefore);
            const memoryAfterBytes: MemorySnapshot = process.memoryUsage();

            samples.push({
                durationMs,
                cpuUserMs: cpu.user / 1000,
                cpuSystemMs: cpu.system / 1000,
                memoryBeforeBytes,
                memoryAfterBytes,
                memoryDeltaBytes: {
                    rss: memoryAfterBytes.rss - memoryBeforeBytes.rss,
                    heapUsed: memoryAfterBytes.heapUsed - memoryBeforeBytes.heapUsed,
                    heapTotal: memoryAfterBytes.heapTotal - memoryBeforeBytes.heapTotal,
                    external: memoryAfterBytes.external - memoryBeforeBytes.external,
                    arrayBuffers: memoryAfterBytes.arrayBuffers - memoryBeforeBytes.arrayBuffers,
                },
                result: Array.isArray(result)
                    ? { kind: "array", count: result.length }
                    : { kind: result === undefined ? "undefined" : "value" },
                hasSyntaxError: command.hasSyntaxError,
            });
        } finally {
            command.dispose();
        }
    }

    return {
        warmupRuns: 1,
        measuredRuns: samples.length,
        durationMs: statistics(samples.map((sample: Sample) => sample.durationMs)),
        cpuUserMs: statistics(samples.map((sample: Sample) => sample.cpuUserMs)),
        cpuSystemMs: statistics(samples.map((sample: Sample) => sample.cpuSystemMs)),
        memoryDeltaBytes: {
            rss: memoryStatistics(samples, "rss"),
            heapUsed: memoryStatistics(samples, "heapUsed"),
            heapTotal: memoryStatistics(samples, "heapTotal"),
            external: memoryStatistics(samples, "external"),
            arrayBuffers: memoryStatistics(samples, "arrayBuffers"),
        },
        samples,
    };
}

export async function runBenchmarks(config: BenchmarkConfig, baseDirectory: string): Promise<BenchmarkReport> {
    const library: Library.ILibrary =
        config.library === "standard"
            ? ResultUtils.assertOk(LibrarySymbolUtils.createLibrary(StandardLibrarySymbols, () => new Map(), undefined))
            : Library.NoOpLibrary;

    const inspectionSettings: InspectionSettings = {
        ...DefaultSettings,
        library,
        eachScopeById: undefined,
        typeStrategy: TypeStrategy.Extended,
        isWorkspaceCacheAllowed: false,
    };

    const validationSettings: ValidationSettings = {
        ...inspectionSettings,
        checkDiagnosticsOnParseError: true,
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: true,
        checkUnknownIdentifiers: true,
        source: "benchmark",
    };

    const results: CommandReport[] = [];

    // Preflight every input before doing any measured work.
    const files: {
        path: string;
        text: string;
        fileBytes: number;
        operations: ReadonlyArray<BenchmarkOperation>;
    }[] = [];

    for (const file of config.files) {
        const path: string = resolve(baseDirectory, file.path);
        // eslint-disable-next-line no-await-in-loop
        const content: string = await readFile(path, "utf8");
        const text: string = content.replace(/^\uFEFF/, "");
        const lines: string[] = text.split(/\r\n|\r|\n/);

        for (const operation of file.operations) {
            if (
                "position" in operation &&
                (operation.position.line >= lines.length ||
                    operation.position.character > lines[operation.position.line].length)
            ) {
                throw new Error(`${path}: ${operation.kind} position is outside the document`);
            }
        }

        files.push({ path, text, fileBytes: Buffer.byteLength(content, "utf8"), operations: file.operations });
    }

    for (const file of files) {
        const commands: ReadonlyArray<BenchmarkOperation | { readonly kind: "lexParse" }> = [
            ...(config.lexParse ? [{ kind: "lexParse" as const }] : []),
            ...file.operations,
        ];

        for (const operation of commands) {
            try {
                // Samples are deliberately sequential so operations never compete for CPU or memory.
                // eslint-disable-next-line no-await-in-loop
                const measurement: Measurement = await measureCommand((): Promise<PreparedCommand> => {
                    if (operation.kind === "lexParse") {
                        return Promise.resolve({
                            run: async (): Promise<unknown> => {
                                const task: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                                    inspectionSettings,
                                    file.text,
                                );

                                if (TaskUtils.isError(task)) {
                                    throw task.error;
                                }

                                return task;
                            },
                            dispose: (): void => {},
                        });
                    }

                    return prepareOperation(file.path, file.text, operation, inspectionSettings, validationSettings);
                });

                results.push({
                    path: file.path,
                    fileBytes: file.fileBytes,
                    operation,
                    status: "ok",
                    measurement,
                });
            } catch (error: unknown) {
                results.push({
                    path: file.path,
                    fileBytes: file.fileBytes,
                    operation,
                    status: "error",
                    error: formatError(error),
                });
            }
        }
    }

    return {
        environment: {
            node: process.version,
            platform: process.platform,
            architecture: process.arch,
            cpu: cpus()[0]?.model,
            gcBeforeEachRun: globalThis.gc !== undefined,
        },
        library: config.library,
        operationTiming: "fresh-analysis-excluding-lex-parse",
        results,
    };
}

export function formatError(error: unknown): string {
    if (
        error !== null &&
        (typeof error === "object" || typeof error === "function") &&
        "message" in error &&
        typeof error.message === "string"
    ) {
        return error.message;
    }

    return inspect(error, { depth: 2 });
}

async function prepareOperation(
    path: string,
    text: string,
    operation: BenchmarkOperation,
    inspectionSettings: InspectionSettings,
    validationSettings: ValidationSettings,
): Promise<PreparedCommand> {
    documentVersion += 1;
    const document: TextDocument = TextDocument.create(pathToFileURL(path).href, "powerquery", documentVersion, text);

    const analysisSettings: AnalysisSettings = {
        inspectionSettings,
        // validate() obtains its own analysis. Reuse only this sample's already-parsed instance.
        isWorkspaceCacheAllowed: operation.kind === "validate",
        initialCorrelationId: inspectionSettings.initialCorrelationId,
        traceManager: inspectionSettings.traceManager,
    };

    const analysis: Analysis = AnalysisUtils.analysis(document, analysisSettings);

    try {
        const parseState: ParseState | undefined = ResultUtils.assertOk(await analysis.getParseState());

        if (parseState === undefined) {
            throw new Error(`${path}: lexing did not produce a parse state`);
        }

        const hasSyntaxError: boolean = ResultUtils.assertOk(await analysis.getParseError()) !== undefined;

        return {
            hasSyntaxError,
            dispose: (): void => analysis.dispose(),
            run: async (): Promise<unknown> => {
                switch (operation.kind) {
                    case "getAutocompleteItems":
                        return ResultUtils.assertOk(await analysis.getAutocompleteItems(operation.position));
                    case "getDefinition":
                        return ResultUtils.assertOk(await analysis.getDefinition(operation.position));
                    case "getHover":
                        return ResultUtils.assertOk(await analysis.getHover(operation.position));
                    case "getSignatureHelp":
                        return ResultUtils.assertOk(await analysis.getSignatureHelp(operation.position));
                    case "getRenameEdits":
                        return ResultUtils.assertOk(
                            await analysis.getRenameEdits(operation.position, operation.newName),
                        );
                    case "getDocumentSymbols":
                        return ResultUtils.assertOk(await analysis.getDocumentSymbols());
                    case "getFoldingRanges":
                        return ResultUtils.assertOk(await analysis.getFoldingRanges());
                    case "getPartialSemanticTokens":
                        return ResultUtils.assertOk(await analysis.getPartialSemanticTokens());
                    case "validate":
                        return ResultUtils.assertOk(await validate(document, analysisSettings, validationSettings))
                            ?.diagnostics;
                    case "validateUnknownIdentifiers":
                        return validateUnknownIdentifiers(
                            validationSettings,
                            parseState.contextState.nodeIdMapCollection,
                            analysis.getTypeCache(),
                        );
                }
            },
        };
    } catch (error: unknown) {
        analysis.dispose();

        throw error;
    }
}

function statistics(values: ReadonlyArray<number>): Statistics {
    return {
        average: values.reduce((sum: number, value: number) => sum + value, 0) / values.length,
        minimum: Math.min(...values),
        maximum: Math.max(...values),
    };
}

function memoryStatistics(samples: ReadonlyArray<Sample>, key: keyof MemorySnapshot): Statistics {
    return statistics(samples.map((sample: Sample) => sample.memoryDeltaBytes[key]));
}
