// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// node --expose-gc benchmarks\benchmarkServices.cjs <parser root> <corpus manifest> <output> [samples=5] [files=7] [profile phase]
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const inspector = require("node:inspector");
const { promisify } = require("node:util");

const [parserArgument, corpusArgument, outputArgument, samplesArgument = "5", filesArgument = "7", profilePhase] =
    process.argv.slice(2);
assert(parserArgument && corpusArgument && outputArgument, "Expected parser root, corpus manifest and output path");
assert(global.gc, "Run with --expose-gc; collection is outside measured phases");
const samples = Number(samplesArgument);
const fileCount = Number(filesArgument);
assert(Number.isSafeInteger(samples) && samples > 0, "samples must be a positive integer");
assert(Number.isSafeInteger(fileCount) && fileCount > 0, "files must be a positive integer");
const parserRoot = path.resolve(parserArgument);
const serviceRoot = path.resolve(__dirname, "..");
const output = path.resolve(outputArgument);
const warmups = samples === 1 ? 0 : 1;
const experiment = require("./scopeExperiment.cjs");
if (process.env.SCOPE_EXPERIMENT) experiment.install(process.env.SCOPE_EXPERIMENT);

// Redirect root AND deep imports only in this process, without npm links or dependency edits.
const redirected = require("./localParser.cjs")(parserRoot);

const PQP = require("@microsoft/powerquery-parser");
const LS = require(path.join(serviceRoot, "lib", "powerquery-language-services"));
const { TextDocument } = require("vscode-languageserver-textdocument");
const { validateDuplicateIdentifiers } = require(
    path.join(serviceRoot, "lib", "powerquery-language-services", "validate", "validateDuplicateIdentifiers"),
);
const { validateFunctionExpression } = require(
    path.join(serviceRoot, "lib", "powerquery-language-services", "validate", "validateFunctionExpression"),
);
const { validateInvokeExpression } = require(
    path.join(serviceRoot, "lib", "powerquery-language-services", "validate", "validateInvokeExpression"),
);
const { validateUnknownIdentifiers } = require(
    path.join(serviceRoot, "lib", "powerquery-language-services", "validate", "validateUnknownIdentifiers"),
);
assert.equal(PQP.Parser.ParserUtils, require("@microsoft/powerquery-parser/lib/powerquery-parser/parser").ParserUtils);

const library = PQP.ResultUtils.assertOk(
    LS.LibrarySymbolUtils.createLibrary(
        JSON.parse(
            fs.readFileSync(path.join(serviceRoot, "src", "test", "standard-library-symbols-en-us.json"), "utf8"),
        ),
        () => new Map(),
        () => undefined,
    ),
);
const inspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: false,
    library,
    eachScopeById: undefined,
    typeStrategy: LS.TypeStrategy.Extended,
};
const analysisSettings = {
    inspectionSettings,
    isWorkspaceCacheAllowed: false,
    initialCorrelationId: undefined,
    traceManager: PQP.DefaultSettings.traceManager,
};
const validationSettings = LS.ValidationSettingsUtils.createValidationSettings(inspectionSettings);
const offset = Number(process.env.BENCHMARK_OFFSET ?? "0");
const timeoutMs = Number(process.env.PHASE_TIMEOUT_MS ?? "20000");
assert(Number.isSafeInteger(offset) && offset >= 0);
assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0);
const corpus = JSON.parse(fs.readFileSync(corpusArgument, "utf8")).results.slice(offset, offset + fileCount);
assert.equal(corpus.length, fileCount);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const report = {
    recordedAt: new Date().toISOString(),
    runtime: process.version,
    cpu: os.cpus()[0].model,
    parserRoot,
    parserRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: parserRoot, encoding: "utf8" }).trim(),
    serviceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: serviceRoot, encoding: "utf8" }).trim(),
    compiledScopeHashes: Object.fromEntries(
        ["scopeInspection", "scopeBindings", "scopeMap"]
            .filter(
                name =>
                    name === "scopeInspection" ||
                    fs.existsSync(
                        path.join(
                            serviceRoot,
                            "lib",
                            "powerquery-language-services",
                            "inspection",
                            "scope",
                            `${name}.js`,
                        ),
                    ),
            )
            .map(name => [
                name,
                createHash("sha256")
                    .update(
                        fs.readFileSync(
                            path.join(
                                serviceRoot,
                                "lib",
                                "powerquery-language-services",
                                "inspection",
                                "scope",
                                `${name}.js`,
                            ),
                        ),
                    )
                    .digest("hex"),
            ]),
    ),
    samples,
    warmups,
    offset,
    timeoutMs,
    validationOnly: process.env.VALIDATION_ONLY === "1",
    scopeExperiment: process.env.SCOPE_EXPERIMENT ?? null,
    profilePhase: profilePhase ?? null,
    method: "Sequential cold per-document validation with shared invocation/identifier type cache, then separate editor analysis. Full GC before each iteration, excluded from timers; natural GC during phases included. Standard-library fixture, no host-specific external resolver. Editor parse excluded from service timers. Hashing/output accounting outside timers.",
    libraryDefinitions: library.libraryDefinitions.staticLibraryDefinitions.size,
    results: [],
};

function save() {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}

async function phase(name, action, row, shouldProfile) {
    process.stderr.write(`${row.file}: ${name}\n`);
    row.activePhase = name;
    save();
    let session;
    let post;
    if (shouldProfile && profilePhase === name) {
        session = new inspector.Session();
        session.connect();
        post = promisify(session.post.bind(session));
        await post("Profiler.enable");
        await post("Profiler.start");
    }
    const heapBefore = process.memoryUsage().heapUsed;
    const start = process.hrtime.bigint();
    let result;
    try {
        result = await action();
    } finally {
        row.timings[name] = Number(process.hrtime.bigint() - start) / 1e6;
        row.heapAfterBytes[name] = process.memoryUsage().heapUsed;
        row.heapDeltaBytes[name] = row.heapAfterBytes[name] - heapBefore;
        if (session) {
            const { profile } = await post("Profiler.stop");
            session.disconnect();
            const counts = new Map();
            for (const node of profile.nodes) {
                const key = `${node.callFrame.functionName || "(anonymous)"} (${path.basename(node.callFrame.url)}:${node.callFrame.lineNumber + 1})`;
                counts.set(key, (counts.get(key) ?? 0) + (node.hitCount ?? 0));
            }
            const total = [...counts.values()].reduce((a, b) => a + b, 0);
            row.profile = {
                phase: name,
                samples: total,
                selfSamples: [...counts]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 35)
                    .map(([frame, hits]) => ({ frame, hits, percent: (100 * hits) / total })),
            };
            if (process.env.PROFILE_DIR) {
                fs.mkdirSync(process.env.PROFILE_DIR, { recursive: true });
                fs.writeFileSync(
                    path.join(process.env.PROFILE_DIR, `${row.file}.${name}.cpuprofile`),
                    JSON.stringify(profile),
                );
            }
        }
        delete row.activePhase;
        save();
    }
    return result;
}

function scopeStats(cache) {
    const scopes = new Set(cache.scopeById.values());
    const maps = new Set([...scopes].map(scope => scope.scopeItemByKey));
    const visited = new Set();
    let physicalMapEntries = 0;
    let hiddenKeys = 0;
    function visit(map) {
        if (!map || visited.has(map)) return;
        visited.add(map);
        if (map instanceof Map) physicalMapEntries += map.size;
        else {
            visit(map.base);
            visit(map.recursive);
            visit(map.parent);
            visit(map.own);
            hiddenKeys += map.hidden?.size ?? 0;
        }
    }
    for (const map of maps) visit(map);
    return {
        cachedNodeScopes: cache.scopeById.size,
        uniqueScopes: scopes.size,
        uniqueMaps: maps.size,
        totalMapEntries: [...maps].reduce((sum, map) => sum + map.size, 0),
        physicalMapEntries,
        hiddenKeys,
        maxScopeSize: [...maps].reduce((max, map) => Math.max(max, map.size), 0),
        cachedTypes: cache.typeById.size,
    };
}

async function iteration(source, row, shouldProfile) {
    const doc = TextDocument.create(pathToFileURL(row.filePath).href, "powerquery", 1, source);
    const lex = await phase("lex", () => PQP.TaskUtils.tryLex(PQP.DefaultSettings, source), row, shouldProfile);
    PQP.TaskUtils.assertIsLexStageOk(lex);
    const parsed = await phase(
        "parse",
        () => PQP.TaskUtils.tryParse(PQP.DefaultSettings, lex.lexerSnapshot),
        row,
        shouldProfile,
    );
    PQP.TaskUtils.assertIsParseStageOk(parsed);
    const maps = parsed.parseState.contextState.nodeIdMapCollection;
    row.astNodes = maps.astNodeById.size;
    const cache = LS.Inspection.TypeCacheUtils.emptyCache();
    const settings = () => ({ ...validationSettings, cancellationToken: new PQP.TimedCancellationToken(timeoutMs) });
    const functionDiagnostics = await phase(
        "functionValidation",
        () => validateFunctionExpression(settings(), maps),
        row,
        shouldProfile,
    );
    const invokeDiagnostics = await phase(
        "invokeValidation",
        () => validateInvokeExpression(settings(), maps, cache),
        row,
        shouldProfile,
    );
    row.scopeAfterInvokes = scopeStats(cache);
    const unknownDiagnostics = await phase(
        "unknownValidation",
        () => validateUnknownIdentifiers(settings(), maps, cache),
        row,
        shouldProfile,
    );
    const duplicateDiagnostics = await phase(
        "duplicateValidation",
        () => validateDuplicateIdentifiers(doc, maps, settings(), new PQP.TimedCancellationToken(timeoutMs)),
        row,
        shouldProfile,
    );
    row.scopes = scopeStats(cache);
    row.diagnostics = {
        functions: functionDiagnostics.length,
        invokes: invokeDiagnostics.length,
        unknown: unknownDiagnostics.length,
        duplicates: duplicateDiagnostics.length,
        hash: digest([...duplicateDiagnostics, ...functionDiagnostics, ...invokeDiagnostics, ...unknownDiagnostics]),
    };
    if (process.env.VALIDATION_ONLY === "1") return;
    const analysis = LS.AnalysisUtils.analysis(doc, analysisSettings);
    try {
        const state = await phase(
            "editorLexParse",
            async () => PQP.ResultUtils.assertOk(await analysis.getParseState()),
            row,
            shouldProfile,
        );
        assert(state);
        assert.equal(PQP.ResultUtils.assertOk(await analysis.getParseError()), undefined);
        const valueIdentifiers = [...maps.astNodeById.values()].filter(
            node =>
                node.kind === PQP.Language.Ast.NodeKind.Identifier &&
                node.identifierContextKind === PQP.Language.Ast.IdentifierContextKind.Value,
        );
        assert(valueIdentifiers.length);
        const position = doc.positionAt(
            valueIdentifiers[Math.floor(valueIdentifiers.length / 2)].tokenRange.positionStart.codeUnit + 1,
        );
        row.editorPosition = position;
        const symbols = await phase(
            "documentSymbols",
            async () => PQP.ResultUtils.assertOk(await analysis.getDocumentSymbols()),
            row,
            shouldProfile,
        );
        const semantic = await phase(
            "semanticTokens",
            async () => PQP.ResultUtils.assertOk(await analysis.getPartialSemanticTokens()),
            row,
            shouldProfile,
        );
        const autocomplete = await phase(
            "autocomplete",
            async () => PQP.ResultUtils.assertOk(await analysis.getAutocompleteItems(position)),
            row,
            shouldProfile,
        );
        const hover = await phase(
            "hoverAfterAutocomplete",
            async () => PQP.ResultUtils.assertOk(await analysis.getHover(position)),
            row,
            shouldProfile,
        );
        assert(Array.isArray(symbols), "Expected document-symbol output");
        assert(Array.isArray(semantic), "Expected semantic-token output");
        assert(Array.isArray(autocomplete), "Expected autocomplete output at the selected identifier");
        row.editor = {
            symbols: symbols?.length,
            semanticTokens: semantic?.length,
            autocompleteItems: autocomplete?.length,
            hash: digest([symbols, semantic, autocomplete, hover]),
        };
    } finally {
        analysis.dispose();
    }
}

async function main() {
    for (const entry of corpus) {
        const raw = fs.readFileSync(entry.filePath, "utf8");
        assert.equal(createHash("sha256").update(raw).digest("hex"), entry.sourceSha256);
        const source = raw.replace(/^\uFEFF/, "");
        const result = {
            file: entry.file,
            filePath: entry.filePath,
            bytes: entry.bytes,
            sourceSha256: entry.sourceSha256,
            runs: [],
        };
        report.results.push(result);
        for (let i = 0; i < warmups + samples; i++) {
            global.gc();
            const row = {
                file: entry.file,
                filePath: entry.filePath,
                warmup: i < warmups,
                timings: {},
                heapAfterBytes: {},
                heapDeltaBytes: {},
            };
            result.runs.push(row);
            try {
                await iteration(source, row, i === warmups);
                row.succeeded = true;
            } catch (error) {
                row.succeeded = false;
                row.error = { name: error.name, message: error.message, stack: error.stack };
                save();
                throw error;
            }
            save();
        }
        const measured = result.runs.filter(row => !row.warmup);
        result.phases = Object.fromEntries(
            Object.keys(measured[0].timings).map(name => {
                const values = measured.map(row => row.timings[name]);
                const sorted = [...values].sort((a, b) => a - b);
                const kept = sorted.length >= 5 ? sorted.slice(1, -1) : sorted;
                return [name, { samplesMs: values, meanMs: kept.reduce((a, b) => a + b, 0) / kept.length }];
            }),
        );
        save();
    }
    report.redirectedParserImports = [...redirected].sort();
    report.experimentStats = experiment.stats;
    save();
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
