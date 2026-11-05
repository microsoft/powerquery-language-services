<!-- markdownlint-disable -->

# Power Query libraries

This monorepo develops three TypeScript libraries for the Power Query / M language:

- [Parser](packages/powerquery-parser/README.md): lexing, parsing, ASTs, types, and shared utilities.
- [Formatter](packages/powerquery-formatter/README.md): formatting expressions and section documents.
- [Language services](packages/powerquery-language-services/README.md): IntelliSense, diagnostics,
  navigation, renaming, symbols, and formatting for editors.

These are libraries, not a query execution engine or standalone language server. Their existing
`@microsoft/powerquery-*` npm names, CommonJS entry points, declaration paths, and deep imports are preserved.
Consumers require Node.js 22 or later. See each package's README for installation and API examples.

## Develop

Use Node.js **22.15.0** and npm **11.5.2** from the repository root on Windows or Linux:

```powershell
npm ci --ignore-scripts
npm run clean
npm run build
npm run lint
npm test
npm run validate:release
```

There is one lockfile. Builds explicitly run parser, formatter, then services; no `npm link`,
per-package installs, or external source checkouts are needed. `npm test` includes all unit suites,
the parser resource suite, and release-helper tests. `npm run test:unit` and
`npm run test:parser:resources` are focused alternatives.

Use workspace commands after building prerequisites:

```powershell
npm test --workspace @microsoft/powerquery-formatter
npm run watch --workspace @microsoft/powerquery-language-services
npm run script:nodeDump --workspace @microsoft/powerquery-parser
npm run script:recursiveDirectoryFormat --workspace @microsoft/powerquery-formatter -- .\queries ".pq,.mout"
```

The last command overwrites formatted files; review the target directory first.
Relative script arguments resolve from the selected package directory; use absolute paths for
payloads or queries stored elsewhere.
Benchmark commands and methodology are documented in the
[formatter](packages/powerquery-formatter/README.md#benchmark) and
[services](packages/powerquery-language-services/README.md#benchmarking) READMEs.
Open the repository root in VS Code for package-aware build/debug tasks.

## Release preparation

All three packages share a version, with exact internal dependencies. The initial group version is
**5.0.0**, derived from the frozen upstream versions, not the historical proposal's 3.0.0.
Version changes are normal reviewed source changes:

```powershell
npm run version:set -- 5.0.0
npm ci --ignore-scripts
npm run clean
npm run build
npm run lint
npm test
npm run validate:release
npm run pack:release
```

Packaging requires existing build outputs and never builds, commits, tags, pushes, or publishes.
The three tarballs and `dist/release-manifest.json` form one release set. The validation command
packs and installs all three tarballs together in an isolated consumer outside the workspaces.
CI artifacts are diagnostic only; there is no public npm publishing workflow.

See [Contributing and release contract](MONOREPO.md) for prerequisites, provenance, manifest paths,
validation boundaries, and the owner-managed check-policy transition.
Existing translations are preserved; replacement localization automation is separate work.

## Related projects

- [vscode-powerquery](https://github.com/microsoft/vscode-powerquery): Power Query language support for VS Code.
- [vscode-powerquery-sdk](https://github.com/microsoft/vscode-powerquery-sdk): Power Query connector SDK.

## Contributing

This project welcomes contributions and suggestions. Most contributions require a
[Contributor License Agreement](https://cla.opensource.microsoft.com). The CLA bot identifies
whether one is needed when you submit a pull request.

This project follows the [Microsoft Open Source Code of Conduct](CODE_OF_CONDUCT.md).
See the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact
[opencode@microsoft.com](mailto:opencode@microsoft.com) with questions.
