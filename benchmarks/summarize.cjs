// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.join(__dirname, "results");
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const reductions = (before, after) => (100 * (before - after)) / before;
const validationPhases = ["functionValidation", "invokeValidation", "unknownValidation", "duplicateValidation"];
function compare(beforeFile, afterFile) {
    const before = read(beforeFile).results[0];
    const after = read(afterFile).results[0];
    const beforeRuns = before.runs.filter(row => !row.warmup);
    const afterRuns = after.runs.filter(row => !row.warmup);
    for (const run of [...before.runs, ...after.runs]) {
        assert.equal(run.succeeded, true);
        assert.equal(run.diagnostics.hash, beforeRuns[0].diagnostics.hash);
        assert.equal(run.editor.hash, beforeRuns[0].editor.hash);
    }
    const phases = Object.fromEntries(
        Object.keys(before.phases).map(name => [
            name,
            {
                beforeMs: before.phases[name].meanMs,
                afterMs: after.phases[name].meanMs,
                reductionPercent: reductions(before.phases[name].meanMs, after.phases[name].meanMs),
            },
        ]),
    );
    const validationBeforeMs = validationPhases.reduce((sum, name) => sum + phases[name].beforeMs, 0);
    const validationAfterMs = validationPhases.reduce((sum, name) => sum + phases[name].afterMs, 0);
    return {
        file: before.file,
        beforeFile,
        afterFile,
        phases,
        validationBeforeMs,
        validationAfterMs,
        validationReductionPercent: reductions(validationBeforeMs, validationAfterMs),
        validationShareOfLexParseValidationPercent:
            (100 * validationBeforeMs) / (validationBeforeMs + phases.lex.beforeMs + phases.parse.beforeMs),
        diagnosticsMatch: true,
        editorOutputsMatch: true,
        heapAfterInvocationBeforeMiB: mean(beforeRuns.map(row => row.heapAfterBytes.invokeValidation)) / 1024 ** 2,
        heapAfterInvocationAfterMiB: mean(afterRuns.map(row => row.heapAfterBytes.invokeValidation)) / 1024 ** 2,
        scopeStorageBefore: beforeRuns[0].scopes,
        scopeStorageAfter: afterRuns[0].scopes,
    };
}

const comparison = [2, 6].map(offset =>
    compare(`09-baseline-offset-${offset}-repeat.json`, `09-overlay-offset-${offset}-repeat.json`),
);
const productionComparison = [2, 6].map(offset =>
    compare(`09-baseline-offset-${offset}-repeat.json`, `13-production-offset-${offset}.json`),
);
const baselineScopes = read("10-scopes-baseline.json");
for (const mode of ["intern", "memo", "overlay"]) {
    assert.deepEqual(read(`10-scopes-${mode}.json`).cases, baselineScopes.cases);
}
assert.deepEqual(read("13-scopes-production.json").cases, baselineScopes.cases);
assert.deepEqual(
    read("13-production-offset-2.json").compiledScopeHashes,
    read("13-production-offset-6.json").compiledScopeHashes,
);
const report = {
    recordedAt: new Date().toISOString(),
    status: "Shared scope storage and completed-node memoization are integrated into normal production TypeScript. Historical prototype evidence is retained. Dependency manifests and installed packages are unchanged.",
    serviceRevision: read("09-baseline-offset-2-repeat.json").serviceRevision,
    parserRevision: read("09-baseline-offset-2-repeat.json").parserRevision,
    bottleneck:
        "Language-service scope construction and repeated identifier normalization dominate validation. Parsing is a small fraction of the completed workloads.",
    methodology: {
        sources:
            "The same seven largest production .pq connectors used by the parser investigation; source SHA-256 verified.",
        dependencyWiring:
            "Node synchronous module hooks redirect all root/deep parser imports to local 8d4976f, including formatter imports. No npm link or dependency edits.",
        library:
            "866 definitions from this repository's standard-library fixture; no host-specific/SDK external resolver. Diagnostics and costs depend on this configuration.",
        repeats:
            "One warmup and three arithmetic-mean samples, candidate before baseline in separate processes; earlier pilots used the opposite order. This is not a statistical confidence interval.",
        gc: "Explicit full GC before each document iteration, outside phase timers. Natural GC inside each phase is included.",
        phases: "Validation functions follow the public validate pipeline on a successful parse, sharing its scope/type cache. Editor operations use a separate analysis; parse is awaited before timing them. Autocomplete uses the median value-identifier position; hover follows it and is warm.",
        limits: "4 GiB V8 old-space limit; validation stages have a 20-second cooperative cancellation token except the initial OOM pilot (120 seconds). Failures are never included as successful timing samples.",
        memory: "heapUsed at phase end is not peak or retained heap. Physical map-entry counts count shared native Map instances once, plus separately reported hidden-key sets; they are not byte estimates.",
    },
    comparison,
    productionPort: {
        comparison: productionComparison,
        compiledScopeHashes: read("13-production-offset-2.json").compiledScopeHashes,
        implementation:
            "Per-owner ScopeBindings precomputes allowed aliases and shares immutable binding descriptors. BindingScopeMap masks nonrecursive self aliases; merged read-only maps share parent frames. Duplicate aliases retain materialized-map fallback. A WeakMap per scope cache tracks fully inspected AST/context objects with a WeakSet, invalidated when cache size shrinks.",
        differencesFromPrototype:
            "Per-owner precomputation replaces global interning caches. Completion uses AST/context identity instead of numeric node IDs. Parent-chain lookup and enumeration are iterative; merged enumeration materializes only on demand.",
        methodology:
            "Normal compiled implementation with SCOPE_EXPERIMENT unset, one warmup and three measured samples per connector. Compared with recorded pre-port baseline; not a contemporaneous paired comparison or statistical confidence interval. Compiled hashes identify the uncommitted implementation independently of git HEAD.",
        compatibility:
            "ReadonlyMap lookup, iteration order, recursive aliases and outer shadowing are preserved. Native Map identity is not guaranteed. Scope caches are document/settings-scoped and must be cleared before reuse; backing maps are immutable after publication.",
        verification:
            "All 150 cases / 3,858 scopes match the original baseline with both parsers. Diagnostics and editor outputs match baseline on every production confirmation iteration for the two successful connectors.",
        checks: {
            build: "npm run build passed.",
            lint: "npm run lint -- --quiet passed.",
            installedParser: "npm test: 743 passing.",
            localParser: "The source Mocha suite with a parser-only module preload: 743 passing.",
            initialCompiledSuiteAttempt:
                "737 passing, six failures because tsc does not copy .pq resource fixtures into lib/test/files. Re-ran the source suite with the same local-parser hook so original resource paths resolve; all 743 passed. No product changes were needed.",
        },
        limitations:
            "This port does not resolve the separately recorded inference/cancellation invariants. No successful full-corpus validation or largest-input end-to-end speedup is claimed.",
    },
    profiles: {
        invocationBefore: "01-cchtagetik-profile.json",
        invocationBeforeObservation:
            "Cancelled after about 20.6 seconds. regexMatchLength accounts for 44.6% of self-samples, GC 7.7%; key/value iteration and scope-item construction also prominent. Cancellation handling itself contributes samples near the end.",
        unknownBefore: "05-capacity-unknown-profile.json",
        unknownBeforeObservation: "regexMatchLength 38.1%, calculateJaroWinklers 21.3% of self-samples.",
        unknownAfter: "11-overlay-unknown-profile.json",
        unknownAfterObservation:
            "After the combined prototype, calculateJaroWinklers is 68.1% and case normalization 9.2% of unknown-identifier self-samples.",
    },
    experiments: [
        {
            mode: "intern",
            structure:
                "WeakMap caches for allowed identifier spellings and immutable recursive/nonrecursive binding descriptors, keyed by AST identity.",
            result: "Capacity pilot: invocation 10.66s versus 10.84s baseline, no convincing isolated CPU improvement. Phase-end heap 239 MiB versus 852 MiB; useful allocation reduction, not a retained-heap or peak-memory measurement.",
            artifact: "06-capacity-intern-pilot.json",
        },
        {
            mode: "memo",
            structure:
                "Interning plus a WeakMap<scope-cache, Set<node-id>> of fully inspected nodes. Distinguishes an assigned scope from a node whose children have already been processed.",
            result: "Capacity pilot: invocation 1.94s, unknown identifiers 2.41s, autocomplete 0.67s. Avoids re-enumerating ancestor sections/let bindings for each identifier.",
            artifact: "06-capacity-memo-pilot.json",
        },
        {
            mode: "overlay",
            structure:
                "Memo prototype plus one shared sibling-binding table per scope owner, tiny self-binding masks/recursive overrides, and parent-linked ReadonlyMap views. Duplicate-alias groups fall back to materialized entries to preserve native Map iteration order.",
            result: "Confirmed on CapacityMetricsCES and BQECore; see comparison. Capacity stores 12,497 physical map entries instead of 3,388,313, with 2,506 additional hidden-key set entries.",
            limitation:
                "Historical prototype only; the productionPort section records the integrated implementation separately. Native Map identity changes and document-scoped cache assumptions still apply.",
        },
    ],
    failures: [
        {
            file: "Siteimprove.pq",
            baseline: "00-siteimprove-heap-limit.json",
            outcome:
                "Invocation validation exhausted the 4 GiB heap after about 73 seconds of process runtime; no complete timing sample.",
        },
        {
            file: "CCHTagetik.pq",
            baseline: "01-cchtagetik-profile.json",
            outcome:
                "Invocation validation exceeded the 20-second deadline; cancellation surfaced as an invariant wrapping a Result object.",
        },
        {
            file: "Kusto.pq",
            baseline: "02-smaller-connectors-pilot.json",
            outcome: "Invocation inference invariant at IdentifierExpression.",
        },
        {
            file: "Databricks.pq",
            baseline: "03-remaining-connectors-pilot.json",
            outcome: "Invocation inference invariant at ParenthesizedExpression.",
        },
        {
            file: "LakeHouse.pq",
            baseline: "04-offset-5-pilot.json",
            outcome: "Invocation inference invariant at IdentifierExpression.",
        },
    ],
    largeInputPrototypeCaveat:
        "Memo still times out on Siteimprove. Overlay reaches invocation-inference invariants on Siteimprove and CCHTagetik instead of the earlier resource limit. These are NOT successful validations or proven end-to-end speedups; their equivalence to an unlimited baseline remains unresolved.",
    verification: {
        scopeCases: baselineScopes.cases.length,
        nodeScopes: baselineScopes.nodeScopesCompared,
        scopeResults:
            "All intern/memo/overlay scope values, key iteration order and errors match baseline across both built-in parsers, shadowing, recursion, quoted/generalized identifiers, duplicate aliases and incomplete prefixes.",
        existingScopeTests: "76 existing compiled scope/scope-type tests pass with overlay and the local parser.",
        realInputs:
            "Diagnostic and editor-output hashes match on all recorded confirmation samples for the two successful connectors.",
    },
    recommendations: [
        "Review the integrated shared scope maps and completed-node index, especially ReadonlyMap compatibility and document-scoped cache lifetime.",
        "After scope work, cache normalized suggestion candidates and repeated unknown-name comparisons per document/shared scope frame. Preserve the exact Jaro-Winkler scoring and tie order; do not assume a BK-tree is valid for this similarity function.",
        "Investigate in-flight type-request deduplication and bounded invocation concurrency. Promise.all currently launches every invocation; any change must distinguish recursion from concurrent requests and avoid false cycle detection.",
        "Resolve the observed inference/cancellation invariants before claiming complete validation coverage for all seven connectors.",
    ],
    artifacts: fs
        .readdirSync(root)
        .filter(name => name.endsWith(".json") && name !== "index.json")
        .sort(),
};
fs.writeFileSync(path.join(root, "index.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const entry of productionComparison) {
    console.log(
        `${entry.file}: validation ${entry.validationBeforeMs.toFixed(1)} -> ${entry.validationAfterMs.toFixed(1)} ms; autocomplete ${entry.phases.autocomplete.beforeMs.toFixed(1)} -> ${entry.phases.autocomplete.afterMs.toFixed(1)} ms`,
    );
}
