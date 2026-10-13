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

## Scope cache ownership

`Inspection.TypeCacheUtils.emptyCache()` creates document-local type and scope caches.
`TypeCache.scopeById` owns a `ScopeById` instance, including completed scope-inspection metadata;
there is no module-level completion cache. Short-lived inspection state borrows this same instance,
so completed work is reused across requests within the document.

Standalone scope-inspection callers construct `new Inspection.ScopeById()`.
The `ScopeById` class exposes `get`, `has`, and `size`, controlled `set`, `delete`, and `clear`
methods, and inspection-completion tracking. It is a cache, not an iterable map.
Adding scopes preserves completion metadata, while deleting or replacing a scope invalidates it.
`clear()` resets both scope entries and completion metadata.

Reuse a `TypeCache` only for the same immutable parsed document and inspection settings.
Create a fresh cache when either changes, or clear both `scopeById` and `typeById` before reuse.
Analysis disposal clears both caches. Existing `NodeScope.scopeItemByKey` values remain read-only
shared views; callers must not mutate the scopes or their bindings.

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
