// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// node benchmarks\checkScopes.cjs <parser root> <production|baseline|intern|memo|overlay> <output>
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const [parserRoot, mode, output] = process.argv.slice(2);
assert(parserRoot && mode && output);
require("./localParser.cjs")(path.resolve(parserRoot));
if (!["production", "baseline"].includes(mode)) require("./scopeExperiment.cjs").install(mode);
const PQP = require("@microsoft/powerquery-parser");
const LS = require("../lib/powerquery-language-services");
const inputs = [
    "",
    "1",
    "x",
    "each _",
    "each [a]",
    "let x = 1, y = x in y",
    "let x = 1, f = (x) => x in f(x)",
    "let f = (x) => @f(x) in f(1)",
    "let x = 1 in [x = x, y = @x]",
    '[#"a b" = 1, c = #"a b"]',
    "[a = 1, a = a]",
    'let a = 1, #"a" = 2, b = a in b',
    'let #"a@b" = 1, c = #"a@b" in c',
    '[#"if" = 1, #"and" = #"if"]',
    "section S; shared f = (x) => g(x); shared g = (y) => f(y);",
    "let x = [a = 1] in each x[a]",
    "let x = 1 in each each _",
    "type [a = number, b = text]",
    "(x as number, optional y as text) => x",
];
const prefix = "let x = 1, f = (x as number) => [a = x, b = @a] in f(x)";
for (let i = 0; i <= prefix.length; i++) inputs.push(prefix.slice(0, i));
const report = { mode, cases: [], nodeScopesCompared: 0 };

function replacer(key, value) {
    if (key === "stack") return undefined;
    if (value instanceof Map || value instanceof Set) return [...value];
    return value;
}

async function main() {
    for (const parser of [PQP.Parser.CombinatorialParserV2, PQP.Parser.RecursiveDescentParser]) {
        for (const text of inputs) {
            const parsed = await PQP.TaskUtils.tryLexParse({ ...PQP.DefaultSettings, parser }, text);
            const maps = parsed.parseState?.contextState.nodeIdMapCollection;
            if (!maps) {
                report.cases.push({ text, stage: parsed.stage, lexicalFailure: true });
                continue;
            }
            const scopeById = new Map();
            const outcomes = [];
            const ids = [...maps.astNodeById.keys(), ...maps.contextNodeById.keys()].sort((a, b) => b - a);
            for (const id of ids) {
                const scope = await LS.Inspection.tryNodeScope(PQP.DefaultSettings, maps, undefined, id, scopeById);
                outcomes.push(
                    scope.kind === PQP.ResultKind.Ok
                        ? [id, scope.value.createdForNodeId, [...scope.value.scopeItemByKey]]
                        : [id, scope.error],
                );
            }
            report.nodeScopesCompared += ids.length;
            report.cases.push({
                text,
                stage: parsed.stage,
                nodes: ids.length,
                hash: createHash("sha256").update(JSON.stringify(outcomes, replacer)).digest("hex"),
            });
        }
    }
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${mode}: ${report.cases.length} cases, ${report.nodeScopesCompared} node scopes`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
