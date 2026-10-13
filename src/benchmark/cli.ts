// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { dirname, resolve } from "node:path";
import process from "node:process";
import { readFile } from "node:fs/promises";

import { BenchmarkConfig, parseConfig } from "./config";
import { BenchmarkReport, CommandReport, formatError, runBenchmarks } from "./benchmark";

async function main(): Promise<void> {
    const args: string[] = process.argv.slice(2);

    if (args.length !== 1) {
        throw new Error("Usage: npm run benchmark -- <payload.json | ->");
    }

    const input: string = args[0];
    let json: string;

    if (input === "-") {
        process.stdin.setEncoding("utf8");
        json = "";

        for await (const chunk of process.stdin) {
            json += chunk;
        }
    } else {
        json = await readFile(input, "utf8");
    }

    const config: BenchmarkConfig = parseConfig(JSON.parse(json.replace(/^\uFEFF/, "")));

    const report: BenchmarkReport = await runBenchmarks(
        config,
        input === "-" ? process.cwd() : dirname(resolve(input)),
    );

    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);

    if (report.results.some((result: CommandReport) => result.status === "error")) {
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    process.stderr.write(`Benchmark failed: ${formatError(error)}\n`);
    process.exitCode = 1;
});
