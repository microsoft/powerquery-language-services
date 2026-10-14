# powerquery-language-services

[![Build Status](https://dev.azure.com/ms/powerquery-language-services/_apis/build/status/Microsoft.powerquery-language-services?branchName=master)](https://dev.azure.com/ms/powerquery-language-services/_build/latest?definitionId=343&branchName=master)

This project contains base functionality for implementing a language service for the Power Query / M language.

## Related projects

- [powerquery-parser](https://github.com/microsoft/powerquery-parser): A lexer + parser for Power Query. Also contains features such as type validation.
- [powerquery-formatter](https://github.com/microsoft/powerquery-formatter): A code formatter for Power Query which is bundled in the VSCode extension.
- [vscode-powerquery](https://github.com/microsoft/vscode-powerquery): The VSCode extension for Power Query language support.
- [vscode-powerquery-sdk](https://github.com/microsoft/vscode-powerquery-sdk): The VSCode extension for Power Query connector SDK.

## Build and test

Build

```cmd
npm install
npm run build
```

Test

```cmd
npm test
```

## Benchmarking

For agent-guided runs and comparisons, use the `benchmark-language-services` skill in
`.github\skills\benchmark-language-services\SKILL.md`.

Run a JSON payload against local Power Query files:

```powershell
npm run --silent benchmark -- .\benchmark-input.json
```

Each invocation also saves its JSON report to
`benchmark-results\<UTC-timestamp>-<unique-suffix>\report.json` under the working directory.
This directory is gitignored, and each run gets a new folder so previous reports are not overwritten.
The folder path is printed to stderr; stdout remains the JSON report and can still be redirected.
`errors.log` records operation failures or fatal CLI errors and is empty on success.
Fatal errors before a report is produced leave no `report.json`. Log writes occur outside measured
intervals; failures to create or write logs are reported on stderr and cause a nonzero exit.
Completed reports are emitted to stdout before log writes, so persistence failures do not hide measurements.

Example payload:

```json
{
    "lexParse": true,
    "library": "standard",
    "files": [
        {
            "path": ".\\queries\\example.pq",
            "operations": [
                { "kind": "validateAll" },
                { "kind": "validateUnknownIdentifiers" },
                { "kind": "getDocumentSymbols" },
                { "kind": "getHover", "position": { "line": 0, "character": 10 } },
                { "kind": "getAutocompleteItems", "position": { "line": 0, "character": 10 } }
            ]
        }
    ]
}
```

Paths are relative to the payload file, or absolute. To read JSON from stdin instead, pass `-`;
paths then resolve from the current working directory. Positions use zero-based lines and UTF-16
character offsets, as in LSP. Files and payloads use UTF-8; a leading BOM is removed before parsing,
and positions refer to source text without the BOM. Invalid payloads, unknown properties, and
out-of-range positions are rejected.

`lexParse` defaults to `false`; enabling it adds a separate combined lexer/parser benchmark for each file.
Each file must select at least one operation unless `lexParse` is enabled. `library` defaults to `standard`,
using the repository's English standard-library symbol fixture; set it to `none` for local-only measurements.
Library construction and file I/O are not timed.

| Operation                                                               | Additional fields                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `getAutocompleteItems`, `getDefinition`, `getHover`, `getSignatureHelp` | `position`                                              |
| `getRenameEdits`                                                        | `position`, `newName` (edits are computed, not applied) |
| `getDocumentSymbols`, `getFoldingRanges`, `getPartialSemanticTokens`    | None                                                    |
| `validateAll`                                                           | None; runs the full validation pipeline                 |
| `validateDuplicateIdentifiers`                                          | None; duplicate bindings and fields                     |
| `validateParse`                                                         | None; diagnostics from an existing parse error          |
| `validateFunctionExpression`                                            | None; duplicate function parameters                     |
| `validateInvokeExpression`                                              | None; invocation argument checks                        |
| `validateUnknownIdentifiers`                                            | None; runs only unknown-identifier validation           |

`validateAll` replaces the former `validate` benchmark command. It invokes the actual combined pipeline,
including shared caches, rather than summing isolated measurements. Each individual validation command
runs only its named validator on fresh analysis. `validateParse` measures diagnostic generation, not
parsing; it returns no diagnostics for valid input. Use `lexParse` to measure lexing and parsing.

Every file/operation command runs **one unmeasured warmup followed by exactly ten measured runs**.
Runs are sequential. Language-service runs each receive fresh analysis, with lexing and parsing completed
before timing starts; they do not measure repeated requests against warm analysis caches. Full validation
reuses that sample's prepared analysis via the workspace cache, with a new document version for every run.
The workspace cache can retain the latest validation analysis per file. Analysis disposal is outside timing.

The JSON report includes environment information, per-operation average/minimum/maximum wall-clock and CPU
times in milliseconds, and all ten raw samples. Each sample includes process-memory snapshots before and
after the operation, byte deltas for RSS, heap used/total, external memory, and array buffers, plus a result
kind and array count where applicable. Memory deltas also have average/minimum/maximum summaries.
An `undefined` result is recorded explicitly rather than treated as an error.

**Memory deltas are not allocation counts or peak-memory measurements.** They are process-wide snapshots,
can be negative due to garbage collection, and include runtime noise. The npm command enables explicit GC
before each warmup/sample, after preparation and outside timing; the report records whether GC was available.
CPU measurements are also process-wide. Compare runs on an otherwise idle machine using the same Node version.

Operation failures are recorded with `status: "error"` and a message; other commands continue, and the CLI
exits nonzero after emitting the report. Failed commands do not receive a misleading ten-run average.
Lex/parse benchmarks require syntactically valid input. Language-service operations can run on partial parse
states, with `hasSyntaxError` recorded for each sample; lexical failures prevent operation preparation.
Payload and file-loading failures are printed to stderr and exit nonzero without a benchmark report.

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
