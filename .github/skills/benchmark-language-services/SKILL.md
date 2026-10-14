---
name: benchmark-language-services
description: Run and interpret the repository's JSON-driven Power Query benchmarks. Use when asked to benchmark lexing/parsing, validation, autocomplete, hover, or other language-service operations, or compare their duration, CPU time, and memory use before and after a change.
---

<!-- markdownlint-disable -->

# Benchmark Power Query language services

Use the existing `npm run benchmark` command rather than writing another timing harness.
Run it from the repository root on Windows with Node.js 22 or newer.
The script runs TypeScript directly; a build is not required.

## Choose the workload

Read the Benchmarking section of `README.md`. If the interface has changed, consult
`src\benchmark\config.ts`, `src\benchmark\benchmark.ts`, and `src\benchmark\cli.ts`
before constructing the payload.

Use the files and operations requested by the user. If they are unspecified, clarify the workload
before drawing performance conclusions. A small repository fixture is useful for a smoke run,
not evidence about large-document performance.

- Set `lexParse: true` to add a separate combined lexer/parser benchmark for every file.
- Choose `library: "standard"` for the repository's English standard-library fixture, or
  `"none"` to isolate local names. Keep the library choice fixed across comparisons.
- Select `validateAll` for the actual combined validation pipeline, or isolate a validator with
  `validateDuplicateIdentifiers`, `validateParse`, `validateFunctionExpression`,
  `validateInvokeExpression`, or `validateUnknownIdentifiers`. The former `validate` benchmark
  command has been replaced by `validateAll`.
- `validateParse` measures diagnostic generation from an existing parse error, not parsing itself.
  It returns no diagnostics for valid input. Use `lexParse` to measure lexing and parsing.
- Position-based operations are `getAutocompleteItems`, `getDefinition`, `getHover`,
  `getSignatureHelp`, and `getRenameEdits`. Rename also requires `newName`; it does not edit files.
- Document-wide operations are `getDocumentSymbols`, `getFoldingRanges`, and
  `getPartialSemanticTokens`.

Positions are zero-based LSP line/UTF-16 character offsets, not byte offsets. Inspect the source
to select meaningful locations, such as an identifier for hover or an invocation for signature help.
A leading UTF-8 BOM is stripped before parsing and does not count toward positions.

## Construct and run the payload

This smoke payload works from the repository root when supplied on stdin:

```json
{
    "lexParse": true,
    "library": "standard",
    "files": [
        {
            "path": ".\\src\\test\\files\\HelloWorldWithDocs.pq",
            "operations": [
                { "kind": "validateUnknownIdentifiers" },
                { "kind": "getDocumentSymbols" }
            ]
        }
    ]
}
```

Every invocation automatically saves `report.json` and `errors.log` in a unique
`benchmark-results\<UTC-timestamp>-<unique-suffix>` folder under the working directory.
The directory is gitignored and its path is printed to stderr. Stdout remains the JSON report,
so redirecting it to an additional user-selected or session artifact file is still supported.
Fatal CLI errors are saved in `errors.log`; if no report was produced, there is no `report.json`.
Completed reports remain available on stdout if a log write fails, but the CLI still exits nonzero.

For real workloads, put the JSON payload in a user-selected directory or the session's
artifact directory, not among tracked source files. Use absolute source paths when the payload
is stored outside the repository: relative paths resolve from the payload file's directory.
Use distinct filenames for any additional redirected results so existing measurements are not overwritten.

```powershell
npm run --silent benchmark -- <payload-path.json> > <results-path.json>
```

Replace the placeholders with actual paths, quoting paths containing spaces. `--silent` prevents
npm's banner from contaminating the JSON report. Do not merge stderr into stdout.
Alternatively, pipe the JSON text to `npm run --silent benchmark -- -`; relative source paths
then resolve from the working directory.

Run benchmarks sequentially on an otherwise idle machine. Do not run builds, tests, other
benchmarks, or background agents concurrently with a measurement. Attempt the command before
installing dependencies; restore dependencies only if a missing-package/tool error requires it.

## Check the report

Check the process exit code and parse the output JSON before interpreting results.
Every successful command must have:

- `status: "ok"`;
- `measurement.warmupRuns: 1`;
- `measurement.measuredRuns: 10` and ten entries in `measurement.samples`.

Failures are recorded as `status: "error"` with a message. Other commands continue, but the CLI
exits nonzero. Do not treat a failed command as a zero-duration result. Invalid payloads and
file-loading failures go to stderr and may produce no report.

Lex/parse benchmarks require syntactically valid input. Other operations can use partial parse
states; inspect `hasSyntaxError` in samples. Inspect `result.kind` and any array `count` as well:
an `undefined` or empty result can be legitimate, but is not evidence of meaningful hover,
completion, or signature-help work at the selected position.

## Interpret and compare

Each command receives one unmeasured warmup and ten measured runs. Each language-service run
has fresh analysis, and lexing/parsing finishes before its timed interval. The separate
`lexParse` result measures lexing/parsing. These are not warm-analysis-cache measurements.
File loading, library construction, preparation, explicit GC, and disposal are outside timing.
Full validation reuses only its sample's prepared analysis through a new document version;
the workspace cache can retain the latest validation analysis per file.
`validateAll` measures the real pipeline with its shared caches, not a sum of isolated validator timings.

Report duration from `measurement.durationMs` and CPU time from `cpuUserMs`/`cpuSystemMs`
in milliseconds. Include the average and minimum/maximum rather than selecting the fastest sample.
Memory snapshots and deltas are in bytes. `memoryDeltaBytes` summarizes RSS, heap used/total,
external memory, and array buffers.

Memory deltas are process-wide before/after differences, **not allocation counts, peak usage,
or proof of a memory leak**. They may be negative because of GC. CPU figures are process-wide too.
The npm command enables GC before each warmup/sample outside timing; confirm
`environment.gcBeforeEachRun` when comparing runs.

For before/after comparisons, preserve both reports and keep source contents, positions,
operation order, library, Node version, GC mode, and machine conditions equivalent.
Record the revisions and whether either worktree has uncommitted changes. Never discard
worktree changes to establish a baseline.

Match results by file, operation, position, and rename target. Summarize baseline and candidate
averages with percentage change `(candidate - baseline) / baseline * 100`; if the baseline
is zero, report the absolute difference instead. Repeat the entire workload when results are
noisy, and label uncertainty rather than claiming a small difference is a proven speedup.
Return a concise comparison and the saved report paths.
