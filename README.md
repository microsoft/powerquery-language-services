# powerquery-language-services

[![Build Status](https://dev.azure.com/ms/powerquery-language-services/_apis/build/status/Microsoft.powerquery-language-services?branchName=master)](https://dev.azure.com/ms/powerquery-language-services/_build/latest?definitionId=343&branchName=master)

This library provides language services for the Power Query / M language, for use in editors and other developer tools. It is a library, not a standalone language server or a query execution engine.

## What it does

- Provides autocomplete, hover information, signature help, and go-to-definition.
- Supports renaming local identifiers, document symbols, folding ranges, and semantic highlighting.
- Produces diagnostics for syntax errors, duplicate or unknown identifiers, and function definitions and calls.
- Formats Power Query code.

## How to use

Requires Node.js 22 or later.

```cmd
npm install @microsoft/powerquery-language-services
```

Create a text document and request language features through an analysis instance:

```typescript
import { DefaultSettings, ResultUtils } from "@microsoft/powerquery-parser";
import {
    AnalysisSettings,
    AnalysisUtils,
    Library,
    textDocument,
    TypeStrategy,
} from "@microsoft/powerquery-language-services";

const settings: AnalysisSettings = {
    inspectionSettings: {
        ...DefaultSettings,
        isWorkspaceCacheAllowed: false,
        library: Library.NoOpLibrary,
        eachScopeById: undefined,
        typeStrategy: TypeStrategy.Extended,
    },
    isWorkspaceCacheAllowed: false,
    initialCorrelationId: undefined,
    traceManager: DefaultSettings.traceManager,
};

async function getSymbols() {
    const document = textDocument("file:///example.pq", 1, "let answer = 42 in answer");
    const analysis = AnalysisUtils.analysis(document, settings);
    return ResultUtils.assertOk(await analysis.getDocumentSymbols());
}
```

This example uses no library symbols. Supply your environment's library definitions through `inspectionSettings.library` to enable completion, hover, and signature help for library functions. Position-based requests such as `getHover` and `getAutocompleteItems` accept zero-based line and character positions. Analysis requests return parser `Result` values; the example uses `ResultUtils.assertOk` to extract a successful value or throw on an error.

For internal design, request flow, providers, and caching, see [Architecture](ARCHITECTURE.md).

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
