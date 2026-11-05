<!-- markdownlint-disable -->

# Power Query libraries

This monorepo develops three TypeScript libraries for the Power Query / M language:

- [Parser](packages/powerquery-parser/README.md): lexing, parsing, ASTs, types, and shared utilities.
- [Formatter](packages/powerquery-formatter/README.md): formatting expressions and section documents.
- [Language services](packages/powerquery-language-services/README.md): IntelliSense, diagnostics,
  navigation, renaming, symbols, and formatting for editors.

See each package's README for installation and API examples.

## Develop

From the repository root:

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
Production source is `packages/<name>/src`; tests and developer tools are package-root siblings.
Shared license, security, conduct policy, and issue forms live at the repository root. Packaging
includes the canonical root LICENSE in every tarball. Published entry points and deep imports are
under `lib/<name>`.

## Release preparation

All three packages share a version, with exact internal dependencies. Set a specific version:

```powershell
npm run version:set -- <version>
```

Or increment the shared patch version:

```powershell
npm run version:patch
```

Review the package manifest and lockfile changes, then build and validate the release:

```powershell
npm ci --ignore-scripts
npm run clean
npm run build
npm run lint
npm test
npm run validate:release
npm run pack:release
```

Packaging requires existing build outputs and never builds, commits, tags, pushes, or publishes.
Use the configured npm registry for the root restore and isolated consumer install.
The three tarballs and `dist/release-manifest.json` form one release set. The validation command
packs and installs all three tarballs together in an isolated consumer outside the workspaces.
Tarballs are written to `dist/npm/<package-name>/*.tgz`. The schema-v1 manifest records the shared
version, source commit, package metadata, and SHA-512 integrity. Its `workspace` paths are relative
to the repository root; `tarball` paths are relative to `dist`.

Version preparation updates all manifests and exact internal dependencies together and refreshes
the lockfile. Stable versions use the `latest` tag; prereleases use `next`. `version:patch` follows
SemVer rules, including promoting a prerelease patch to its stable version.

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
