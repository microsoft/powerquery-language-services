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

Shared development tools, including ESLint and Prettier, are declared in the private root manifest.
Use a Node version satisfying the root manifest's development requirement; publishable packages
declare their own consumer requirement. Runtime dependencies remain in each
publishable package so tarballs can be installed independently of the workspace.
Common compiler settings live in `tsconfig.base.json`, with package-specific inputs and safety
options in each package's config. All packages use the same root ESLint rule set.
Mocha's shared config and composite reporter are configured once at the root;
package configs select their suites and the parser resource command selects its own XML output.
Shared build/release helpers and their tests are TypeScript, executed through `ts-node`.
`npm run typecheck:scripts` checks them with strict compiler settings and is included in `npm run lint`.
The small CommonJS Mocha and ESLint configurations remain directly loadable by their tools.

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

Packages are independently versioned, with exact internal pins to each referenced package's
version. Prepare one package from the repository root:

```powershell
npm run release:prepare -- powerquery-parser major
npm run release:prepare -- powerquery-formatter minor
npm run release:prepare -- powerquery-language-services patch
```

The three exact project slugs above and their `@microsoft/`-scoped npm names are accepted.
Supply exactly one project and one increment: `major`, `minor`, or `patch`. Incrementing follows
`semver.inc`, including promotion of prereleases to stable versions. Stable packages use the
`latest` dist tag; prereleases use `next`, independently for each package. The private root
and unselected package versions do not change.

Before invocation, prepare accurate, consumer-impact entries in the selected package's
`CHANGELOG.md` under exactly one `## Unreleased` heading. Prefix each entry with exactly one
of `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`, for example
`- Fixed: Describe the observable corrected behavior.` This is a style illustration, not release
content. Omit contributor-only work and unsupported claims. Review breaking changes and the
requested increment before running the command; the script does not write or polish release notes.

Preparation preflights package metadata, the root lockfile, and the selected changelog, then
runs repository-wide `npm run lint`, `npm run build`, and `npm test` sequentially. Only after
these succeed does it replace `## Unreleased` with `## <version> - <YYYY-MM-DD>`, using the UTC
date captured at invocation. It preserves entries, nested subsections, history, and line endings
verbatim; heading-like text inside fenced code is ignored. Missing, malformed, duplicate, or
empty sections and an existing release for the proposed version are errors.

The selected manifest and direct dependent internal pins are updated: parser releases update
formatter and services pins, formatter releases update services pins, and services releases
update no other package. npm refreshes an isolated copy of the root lockfile with
`--package-lock-only --ignore-scripts`; only the planned workspace versions and pins are accepted.
Finally, `npm run validate:release` checks all three prepared packages together.
Review the dated notes, manifest/pin scope, and lockfile diff after success. Dependent pin edits
without dependent version bumps are preparation changes, not permission to republish those
unchanged versions; prepare dependents separately before publication.

Failures do not auto-fix lint, build, or test problems. Later failures restore original release-file
bytes where still owned by the invocation; detected concurrent edits are preserved and rollback
conflicts are reported. Build/test/pack artifacts are not transaction files. This is process-level
rollback, not a crash-atomic multi-file commit. No staging, commits, tags, pushes, or publication
are performed.

Packaging requires existing build outputs and never builds, commits, tags, pushes, or publishes.
`validate:release` packs and validates the release; use `pack:release` when only packaging is needed.
Use the configured npm registry for the root restore and isolated consumer install.
The three tarballs and `dist/release-manifest.json` form one release set. The validation command
packs and installs all three tarballs together in an isolated consumer outside the workspaces.
Tarballs are written to `dist/npm/<package-name>/*.tgz`. The schema-v2 manifest has exactly
`schemaVersion`, `sourceCommit`, and an ordered `packages` array (parser, formatter, services).
Each package records `name`, its own `version` and `distTag`, `workspace`, `tarball`,
`internalDependencies`, and SHA-512 `integrity`. There is no top-level `releaseVersion`.
Its `workspace` paths are relative to the repository root; `tarball` paths are relative to `dist`.
Validation also accepts schema-v1 manifests with one shared `releaseVersion` and equal package
versions; unsupported schemas are rejected. Packaging all three is a local compatibility check,
not an instruction to publish all three.

The low-level legacy helpers `npm run version:set -- <version>` and `npm run version:patch`
remain available for explicit shared-version maintenance. They update all manifests/pins/tags
and refresh the lockfile, without changelog rollup or preparation gates. `version:patch` requires
equal starting versions and follows SemVer prerelease promotion. Do not combine these helpers
with the independent `release:prepare` workflow.

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
