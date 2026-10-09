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

## Performance investigation

Recorded service benchmarks and data-structure experiments are in
[benchmarks/results/index.json](benchmarks/results/index.json). They use the current local parser,
the seven large connector sources from the parser benchmark manifest, and this repository's
standard-library fixture. Host-specific external type resolution is not included.

Build both repositories first. The harness requires Node 22.15+ for process-local module hooks
and does not modify installed dependencies. For example, measure CapacityMetricsCES with one
warmup and three samples:

```powershell
$env:BENCHMARK_OFFSET = "2"
node --expose-gc --max-old-space-size=4096 benchmarks\benchmarkServices.cjs Q:\src\powerquery-parser Q:\src\powerquery-parser\benchmarks\parser\00-baseline.json benchmarks\results\local-production.json 3 1
```

Normal language-service calls now use shared sibling-binding tables, parent-linked read-only
scope maps and a completed-node inspection cache. No environment toggle is required.
`scopeItemByKey` retains its `ReadonlyMap` contract, including lookup and iteration order,
but is not necessarily a native `Map`. Scope caches belong to one immutable parsed document
and its inspection settings; clear them before reuse with another document.

Leave `SCOPE_EXPERIMENT` unset when measuring this implementation. The retained `intern`,
`memo` and `overlay` hooks are historical benchmark-only prototypes for the pre-port compiled
scope module at `b794f45`; their source-pattern assertions intentionally reject the new module.
The recorded pre-port results remain available for comparison.
`BENCHMARK_OFFSET` selects the first manifest entry (default 0);
the final two numeric arguments specify samples and file count. `VALIDATION_ONLY=1` skips editor
operations, and `PHASE_TIMEOUT_MS` changes the default 20-second cooperative validation deadline.

An optional final argument such as `invokeValidation` or `unknownValidation` profiles that phase.
Profiled runs are separate from confirmation timings. Set `PROFILE_DIR` to retain raw CPU profiles;
self-sample summaries are always saved in the result. Heap measurements are phase-end samples,
not peak memory. Failures remain explicit and are excluded from successful timing comparisons.

`benchmarks\checkScopes.cjs <parser root> production <output>` records current scope
semantics for differential comparison. `node benchmarks\summarize.cjs` verifies the recorded
confirmation output hashes and regenerates the investigation index.

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
