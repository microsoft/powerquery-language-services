// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { join, resolve } from "node:path";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { Mock, mock } from "node:test";
import { spawnSync, SpawnSyncReturns } from "node:child_process";
import { createRequire } from "node:module";
import { expect } from "chai";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { TaskUtils } from "@microsoft/powerquery-parser";
import { tmpdir } from "node:os";

import { BenchmarkConfig, parseConfig } from "../benchmark/config";
import {
    BenchmarkReport,
    CommandReport,
    measureCommand,
    Measurement,
    PreparedCommand,
    runBenchmarks,
} from "../benchmark/benchmark";

type Sample = Measurement["samples"][number];

describe("Benchmark", () => {
    describe("configuration", () => {
        it("accepts lex+parse alone and supplies documented defaults", () => {
            expect(parseConfig({ lexParse: true, files: [{ path: "query.pq" }] })).to.deep.equal({
                lexParse: true,
                library: "standard",
                files: [{ path: "query.pq", operations: [] }],
            });
        });

        for (const value of [
            null,
            {},
            { files: [] },
            { lexParse: "true", files: [{ path: "query.pq" }] },
            { lexParse: true, library: null, files: [{ path: "query.pq" }] },
            { lexParse: true, library: "typo", files: [{ path: "query.pq" }] },
            { lexParse: true, files: [{ path: "" }] },
            { lexParse: true, files: [{ path: "query.pq", operations: null }] },
            { files: [{ path: "query.pq", operations: [] }] },
            { lexParse: true, files: [{ path: "query.pq" }], typo: true },
        ]) {
            it(`rejects invalid payload ${JSON.stringify(value)}`, () => {
                expect(() => parseConfig(value)).to.throw();
            });
        }

        for (const operation of [
            { kind: "typo" },
            { kind: "getHover" },
            { kind: "getHover", position: { line: -1, character: 0 } },
            { kind: "getHover", position: { line: 0, character: 0.5 } },
            { kind: "getHover", position: { line: 0, character: "1" } },
            { kind: "getHover", position: { line: 0, character: 1, typo: 0 } },
            { kind: "getRenameEdits", position: { line: 0, character: 0 } },
            { kind: "getRenameEdits", position: { line: 0, character: 0 }, newName: "" },
            { kind: "validate" },
            { kind: "validateAll", position: { line: 0, character: 0 } },
        ]) {
            it(`rejects invalid operation ${JSON.stringify(operation)}`, () => {
                expect(() => parseConfig({ files: [{ path: "query.pq", operations: [operation] }] })).to.throw();
            });
        }
    });

    it("warms up once, measures ten fresh commands, and reports sample-derived averages", async () => {
        let preparations: number = 0;
        let executions: number = 0;
        let disposals: number = 0;

        const measurement: Measurement = await measureCommand((): Promise<PreparedCommand> => {
            preparations += 1;
            let executed: boolean = false;

            return Promise.resolve({
                run: (): Promise<unknown> => {
                    expect(executed).to.equal(false);
                    executed = true;
                    executions += 1;

                    return Promise.resolve(Array(executions).fill(0));
                },
                dispose: (): void => {
                    expect(executed).to.equal(true);
                    disposals += 1;
                },
            });
        });

        expect([preparations, executions, disposals]).to.deep.equal([11, 11, 11]);
        expect(measurement.warmupRuns).to.equal(1);
        expect(measurement.measuredRuns).to.equal(10);
        expect(measurement.samples.length).to.equal(10);

        expect(measurement.samples.map((sample: Sample) => sample.result.count)).to.deep.equal([
            2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
        ]);

        expect(measurement.durationMs.average).to.equal(
            measurement.samples.reduce((sum: number, sample: Sample) => sum + sample.durationMs, 0) / 10,
        );

        for (const sample of measurement.samples) {
            expect(sample.durationMs).to.be.at.least(0);
            expect(sample.cpuUserMs).to.be.at.least(0);
            expect(sample.cpuSystemMs).to.be.at.least(0);

            expect(sample.memoryDeltaBytes.heapUsed).to.equal(
                sample.memoryAfterBytes.heapUsed - sample.memoryBeforeBytes.heapUsed,
            );
        }
    });

    it("disposes failed warmups without returning a successful measurement", async () => {
        let disposals: number = 0;

        await expectFailure(
            () =>
                measureCommand(() =>
                    Promise.resolve({
                        run: (): Promise<unknown> => Promise.reject(new Error("warmup failed")),
                        dispose: (): void => {
                            disposals += 1;
                        },
                    }),
                ),
            "warmup failed",
        );

        expect(disposals).to.equal(1);
    });

    it("excludes preparation and disposal from the measured interval", async () => {
        let time: number = 0;
        const clock: Mock<typeof performance.now> = mock.method(performance, "now", () => time);

        try {
            const measurement: Measurement = await measureCommand((): Promise<PreparedCommand> => {
                time += 1000;

                return Promise.resolve({
                    run: (): Promise<unknown> => {
                        time += 5;

                        return Promise.resolve(undefined);
                    },
                    dispose: (): void => {
                        time += 1000;
                    },
                });
            });

            expect(measurement.durationMs).to.deep.equal({ average: 5, minimum: 5, maximum: 5 });
            expect(clock.mock.callCount()).to.equal(20);
            expect(measurement.samples.every((sample: Sample) => sample.result.kind === "undefined")).to.equal(true);
        } finally {
            clock.mock.restore();
        }
    });

    it("disposes a failed measured run and does not continue measuring", async () => {
        let executions: number = 0;
        let disposals: number = 0;

        await expectFailure(
            () =>
                measureCommand(() =>
                    Promise.resolve({
                        run: (): Promise<unknown> => {
                            executions += 1;

                            return executions === 2
                                ? Promise.reject(new Error("sample failed"))
                                : Promise.resolve(undefined);
                        },
                        dispose: (): void => {
                            disposals += 1;
                        },
                    }),
                ),
            "sample failed",
        );

        expect([executions, disposals]).to.deep.equal([2, 2]);
    });

    describe("runner and CLI", () => {
        let directory: string;

        beforeEach(async () => {
            directory = await mkdtemp(join(tmpdir(), "powerquery-benchmark-"));
            await writeFile(join(directory, "query.pq"), "let apple = 1 in apple", "utf8");
        });

        afterEach(async () => {
            await rm(directory, { recursive: true, force: true });
        });

        it("runs all operations with fresh parsing once per sample, including validation", async () => {
            const parser: Mock<typeof TaskUtils.tryLexParse> = mock.method(TaskUtils, "tryLexParse");

            try {
                const report: BenchmarkReport = await runBenchmarks(
                    parseConfig({
                        lexParse: true,
                        library: "none",
                        files: [
                            {
                                path: "query.pq",
                                operations: [
                                    { kind: "getAutocompleteItems", position: { line: 0, character: 21 } },
                                    { kind: "getDefinition", position: { line: 0, character: 19 } },
                                    { kind: "getHover", position: { line: 0, character: 19 } },
                                    { kind: "getSignatureHelp", position: { line: 0, character: 19 } },
                                    { kind: "getRenameEdits", position: { line: 0, character: 19 }, newName: "pear" },
                                    { kind: "getDocumentSymbols" },
                                    { kind: "getFoldingRanges" },
                                    { kind: "getPartialSemanticTokens" },
                                    { kind: "validateAll" },
                                    { kind: "validateDuplicateIdentifiers" },
                                    { kind: "validateParse" },
                                    { kind: "validateFunctionExpression" },
                                    { kind: "validateInvokeExpression" },
                                    { kind: "validateUnknownIdentifiers" },
                                ],
                            },
                        ],
                    }),
                    directory,
                );

                expect(report.results.length).to.equal(15);
                expect(parser.mock.callCount()).to.equal(15 * 11);
                expect(report.operationTiming).to.equal("fresh-analysis-excluding-lex-parse");

                for (const result of report.results) {
                    expect(result.status, result.error).to.equal("ok");
                    expect(result.measurement?.measuredRuns).to.equal(10);
                    expect(result.path).to.equal(join(directory, "query.pq"));
                }
            } finally {
                parser.mock.restore();
            }
        }).timeout(30000);

        it("loads the standard library and returns unknown-identifier diagnostics", async () => {
            await writeFile(join(directory, "query.pq"), 'let apple = 1 in {appl, Text.Length("x")}', "utf8");

            const report: BenchmarkReport = await runBenchmarks(
                parseConfig({
                    files: [
                        {
                            path: "query.pq",
                            operations: [{ kind: "validateUnknownIdentifiers" }, { kind: "validateAll" }],
                        },
                    ],
                }),
                directory,
            );

            for (const result of report.results) {
                expect(result.status, result.error).to.equal("ok");
                expect(result.measurement?.samples.every((sample: Sample) => sample.result.count === 1)).to.equal(true);
            }
        }).timeout(30000);

        for (const [text, expectedCounts, hasSyntaxError] of [
            ["let apple = 1, apple = 2 in apple", [2, 0, 0, 0, 0, 2], false],
            ["(x as number, x as number) => x", [0, 0, 2, 0, 0, 2], false],
            ["Text.Length()", [0, 0, 0, 1, 0, 1], false],
            ["let apple = 1 in appl", [0, 0, 0, 0, 1, 1], false],
            ["let apple = 1 in", [0, 1, 0, 0, 0, 1], true],
        ] as const) {
            it(`isolates each validator and runs the combined pipeline for ${text}`, async () => {
                await writeFile(join(directory, "query.pq"), text, "utf8");

                const report: BenchmarkReport = await runBenchmarks(
                    parseConfig({
                        files: [
                            {
                                path: "query.pq",
                                operations: [
                                    { kind: "validateDuplicateIdentifiers" },
                                    { kind: "validateParse" },
                                    { kind: "validateFunctionExpression" },
                                    { kind: "validateInvokeExpression" },
                                    { kind: "validateUnknownIdentifiers" },
                                    { kind: "validateAll" },
                                ],
                            },
                        ],
                    }),
                    directory,
                );

                expect(report.results.length).to.equal(expectedCounts.length);

                for (const [index, result] of report.results.entries()) {
                    expect(result.status, result.error).to.equal("ok");
                    expect(result.measurement?.samples.length).to.equal(10);

                    for (const sample of result.measurement?.samples ?? []) {
                        expect(sample.result, result.operation.kind).to.deep.equal({
                            kind: "array",
                            count: expectedCounts[index],
                        });

                        expect(sample.hasSyntaxError).to.equal(hasSyntaxError);
                    }
                }
            }).timeout(30000);
        }

        it("reports failed lexing explicitly and continues to the next file", async () => {
            await writeFile(join(directory, "invalid.pq"), '"unterminated', "utf8");

            const report: BenchmarkReport = await runBenchmarks(
                parseConfig({
                    lexParse: true,
                    library: "none",
                    files: [{ path: "invalid.pq" }, { path: "query.pq" }],
                }),
                directory,
            );

            expect(report.results.map((result: CommandReport) => result.status)).to.deep.equal(["error", "ok"]);
            expect(report.results[0].error).to.be.a("string").and.not.equal("");
            expect(report.results[0].measurement).to.equal(undefined);
        });

        it("rejects out-of-range positions rather than clamping them", async () => {
            const config: BenchmarkConfig = parseConfig({
                files: [
                    {
                        path: "query.pq",
                        operations: [{ kind: "getHover", position: { line: 0, character: 23 } }],
                    },
                ],
            });

            await expectFailure(() => runBenchmarks(config, directory), "position is outside the document");
        });

        it("marks partial-parse operation samples with syntax-error status", async () => {
            await writeFile(join(directory, "query.pq"), "let apple = 1 in", "utf8");

            const report: BenchmarkReport = await runBenchmarks(
                parseConfig({ files: [{ path: "query.pq", operations: [{ kind: "getDocumentSymbols" }] }] }),
                directory,
            );

            expect(report.results[0].status, report.results[0].error).to.equal("ok");

            expect(report.results[0].measurement?.samples.every((sample: Sample) => sample.hasSyntaxError)).to.equal(
                true,
            );
        });

        it("saves distinct reports and error logs for payload files, stdin, and failures", async () => {
            const config: unknown = { lexParse: true, library: "none", files: [{ path: "query.pq" }] };
            await writeFile(join(directory, "payload.json"), `\uFEFF${JSON.stringify(config)}`, "utf8");
            await writeFile(join(directory, "query.pq"), "\uFEFFlet apple = 1 in apple", "utf8");
            const cli: string = resolve(__dirname, "..", "benchmark", "cli.ts");
            const args: string[] = [createRequire(__filename).resolve("ts-node/dist/bin"), cli];
            const workingDirectory: string = join(directory, "working");
            await mkdir(workingDirectory);

            const fromFile: SpawnSyncReturns<string> = spawnSync(
                process.execPath,
                [...args, join(directory, "payload.json")],
                {
                    encoding: "utf8",
                    cwd: workingDirectory,
                    timeout: 30000,
                },
            );

            expect(fromFile.status, fromFile.stderr).to.equal(0);
            expect(JSON.parse(fromFile.stdout).results[0].measurement.measuredRuns).to.equal(10);

            const fileLogsRoot: string = join(workingDirectory, "benchmark-results");
            const fileRuns: string[] = await readdir(fileLogsRoot);
            expect(fileRuns).to.have.length(1);
            const fileLogs: string = join(fileLogsRoot, fileRuns[0]);
            expect(fromFile.stderr).to.include(`Benchmark logs: ${fileLogs}`);
            expect(await readFile(join(fileLogs, "report.json"), "utf8")).to.equal(fromFile.stdout);
            expect(await readFile(join(fileLogs, "errors.log"), "utf8")).to.equal("");

            const fromStdin: SpawnSyncReturns<string> = spawnSync(process.execPath, [...args, "-"], {
                input: `\uFEFF${JSON.stringify(config)}`,
                encoding: "utf8",
                cwd: directory,
                timeout: 30000,
            });

            expect(fromStdin.status, fromStdin.stderr).to.equal(0);
            expect(JSON.parse(fromStdin.stdout).results[0].status).to.equal("ok");

            const logsRoot: string = join(directory, "benchmark-results");
            const successfulRuns: string[] = await readdir(logsRoot);
            expect(successfulRuns).to.have.length(1);
            const successfulLogs: string = join(logsRoot, successfulRuns[0]);
            expect(await readFile(join(successfulLogs, "report.json"), "utf8")).to.equal(fromStdin.stdout);

            await writeFile(join(directory, "query.pq"), '"unterminated', "utf8");

            const failure: SpawnSyncReturns<string> = spawnSync(process.execPath, [...args, "-"], {
                input: JSON.stringify(config),
                encoding: "utf8",
                cwd: directory,
                timeout: 30000,
            });

            expect(failure.status, failure.stderr).to.equal(1);
            expect(JSON.parse(failure.stdout).results[0].status).to.equal("error");

            const runsAfterFailure: string[] = await readdir(logsRoot);
            expect(runsAfterFailure).to.have.length(2);

            const failedLogs: string = join(
                logsRoot,
                runsAfterFailure.filter((name: string) => !successfulRuns.includes(name))[0],
            );

            expect(await readFile(join(failedLogs, "report.json"), "utf8")).to.equal(failure.stdout);

            expect(await readFile(join(failedLogs, "errors.log"), "utf8")).to.include(
                JSON.parse(failure.stdout).results[0].error,
            );

            expect(await readFile(join(successfulLogs, "report.json"), "utf8")).to.equal(fromStdin.stdout);

            const invalid: SpawnSyncReturns<string> = spawnSync(process.execPath, [...args, "-"], {
                input: "{",
                encoding: "utf8",
                cwd: directory,
                timeout: 30000,
            });

            expect(invalid.status, invalid.stderr).to.equal(1);
            expect(invalid.stdout).to.equal("");
            const runsAfterInvalid: string[] = await readdir(logsRoot);
            expect(runsAfterInvalid).to.have.length(3);

            const invalidLogs: string = join(
                logsRoot,
                runsAfterInvalid.filter((name: string) => !runsAfterFailure.includes(name))[0],
            );

            const errorLog: string = await readFile(join(invalidLogs, "errors.log"), "utf8");
            expect(errorLog).to.include("Benchmark failed:");
            expect(invalid.stderr).to.include(errorLog);
            expect(await readdir(invalidLogs)).to.deep.equal(["errors.log"]);
        }).timeout(90000);

        it("reports a logging setup failure without overwriting an existing file", async () => {
            const logsRoot: string = join(directory, "benchmark-results");
            await writeFile(logsRoot, "existing file", "utf8");

            const failure: SpawnSyncReturns<string> = spawnSync(
                process.execPath,
                [
                    createRequire(__filename).resolve("ts-node/dist/bin"),
                    resolve(__dirname, "..", "benchmark", "cli.ts"),
                    "-",
                ],
                {
                    input: JSON.stringify({ lexParse: true, files: [{ path: "query.pq" }] }),
                    encoding: "utf8",
                    cwd: directory,
                    timeout: 30000,
                },
            );

            expect(failure.status, failure.stderr).to.equal(1);
            expect(failure.stdout).to.equal("");
            expect(failure.stderr).to.include("Benchmark failed:");
            expect(failure.stderr).to.include("benchmark-results");
            expect(await readFile(logsRoot, "utf8")).to.equal("existing file");
        }).timeout(45000);
    });
});

async function expectFailure(action: () => Promise<unknown>, message: string): Promise<void> {
    try {
        await action();
    } catch (error: unknown) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.contain(message);

        return;
    }

    throw new Error(`Expected failure containing: ${message}`);
}
