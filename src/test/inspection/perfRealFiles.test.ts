// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Performance tests on real .pq connector files measuring type inspection with fastAnyUnion.

import * as PQP from "@microsoft/powerquery-parser";
import * as fs from "fs";
import * as path from "path";

import { Inspection, InspectionSettings, Library, TypeStrategy } from "../../powerquery-language-services";
import { TypeCache, TypeCacheUtils } from "../../powerquery-language-services/inspection";
import { expect } from "chai";
import "mocha";

const DataConnectorsRoot = "C:\\Users\\jobolton\\Downloads\\DataConnectors";

interface PerfResult {
    file: string;
    lines: number;
    parseMs: number;
    inspectionMs: number;
}

function findPqFiles(dir: string, maxFiles: number = 10): string[] {
    const results: Array<{ path: string; size: number }> = [];

    function walk(d: string): void {
        let entries: fs.Dirent[];

        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(d, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.name.endsWith(".pq") || entry.name.endsWith(".m")) {
                try {
                    const stat = fs.statSync(fullPath);
                    results.push({ path: fullPath, size: stat.size });
                } catch {
                    // skip
                }
            }
        }
    }

    walk(dir);
    results.sort((a, b) => b.size - a.size);

    return results.slice(0, maxFiles).map((r) => r.path);
}

async function measureFileInspection(filePath: string): Promise<PerfResult | undefined> {
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.split("\n");
    const lineCount = lines.length;

    if (lineCount < 100) {
        return undefined; // skip tiny files
    }

    // Parse
    const parseStart = Date.now();
    const triedLexParse: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(PQP.DefaultSettings, text);
    const parseMs = Date.now() - parseStart;

    if (!PQP.TaskUtils.isParseStageOk(triedLexParse)) {
        return undefined; // skip files that don't parse cleanly
    }

    // Pick a position roughly 2/3 through the file for inspection
    const targetLine = Math.floor(lineCount * 0.66);
    const targetLineText = lines[targetLine] || "";
    const targetChar = Math.min(10, targetLineText.length);
    const position = { line: targetLine, character: targetChar };

    const inspectionSettings: InspectionSettings = {
        ...PQP.DefaultSettings,
        isWorkspaceCacheAllowed: false,
        library: Library.NoOpLibrary,
        eachScopeById: undefined,
        typeStrategy: TypeStrategy.Extended,
    };

    const typeCache: TypeCache = TypeCacheUtils.emptyCache();

    // Measure inspection
    const inspectionStart = Date.now();

    try {
        await Inspection.tryInspect(inspectionSettings, text, position, typeCache);
    } catch {
        // Some files may error
    }

    const inspectionMs = Date.now() - inspectionStart;

    return {
        file: path.relative(DataConnectorsRoot, filePath),
        lines: lineCount,
        parseMs,
        inspectionMs,
    };
}

describe("Performance on real .pq files", function () {
    this.timeout(300000);

    const files = findPqFiles(DataConnectorsRoot, 15);

    it("measures type inspection on largest connector files", async function () {
        console.log(`\n  Testing ${files.length} largest .pq files from DataConnectors:\n`);

        const results: PerfResult[] = [];

        for (const filePath of files) {
            const result = await measureFileInspection(filePath);

            if (result) {
                results.push(result);
                const indicator = result.inspectionMs > 5000 ? " ⚠️ SLOW" : "";
                console.log(
                    `    ${result.file.padEnd(70)} ${result.lines.toString().padStart(6)} lines | ` +
                        `parse ${result.parseMs.toString().padStart(5)}ms | inspect ${result.inspectionMs.toString().padStart(6)}ms${indicator}`,
                );
            }
        }

        console.log(`\n  --- Summary ---`);

        const totalParse = results.reduce((s, r) => s + r.parseMs, 0);
        const totalInspect = results.reduce((s, r) => s + r.inspectionMs, 0);
        const maxInspect = results.reduce((m, r) => Math.max(m, r.inspectionMs), 0);
        const avgInspect = results.length > 0 ? Math.round(totalInspect / results.length) : 0;

        console.log(`  Files tested: ${results.length}`);
        console.log(`  Total parse time: ${totalParse}ms`);
        console.log(`  Total inspect time: ${totalInspect}ms`);
        console.log(`  Max single inspection: ${maxInspect}ms`);
        console.log(`  Avg inspection: ${avgInspect}ms`);
        console.log();

        expect(results.length).to.be.greaterThan(0);
    });
});
