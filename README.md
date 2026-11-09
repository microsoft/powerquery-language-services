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

## Localization

Parser and language-service messages use `@vscode/l10n` bundles in each package's
`src/localization/bundles/bundle.l10n[.<locale>].json`. Keys are the English messages,
including named placeholders such as `{identifier}`. The English bundle retains translator
comments as `{ "message": "...", "comment": ["..."] }` values. Translated bundles use strings or
the same message/comment object form when retaining localized context.
Keep placeholder names unchanged in translations.

Code-defined lookups in `src/localization/templates.ts` map existing public message IDs to
English bundle keys. English values and translator-comment metadata are read from the English
bundle, not copied into a second catalog. When adding or changing a message, update the code
lookup, the English bundle, and the corresponding keys in translated bundles. Missing translations
fall back to English. Existing locale exports, `ILocalizationTemplates`, `Localization` builders,
and `getLocalizationTemplates(locale)` remain available.

Bundles are the only localization resource files. The exported `templates.ts` module is an API,
not a template resource directory; its stable ID lookups preserve the existing TypeScript shape.
Use these APIs or `localization/bundles` JSON rather than the removed template JSON deep imports.

Non-English bundles and their template records load synchronously on first property use and are
cached thereafter. Named locale exports and `TemplatesByLocale` hold lightweight lazy facades;
reading values, enumerating/spreading a template, or changing its property descriptors materializes
that locale once. Merely selecting a locale or enumerating the locale map does not load its bundle.
The English bundle and ID/metadata mapping remain an intentional initialization cost for default
messages and English fallback. Bundlers may still include static JSON assets in their output;
this synchronous adapter does not promise browser network code-splitting.

Do not translate code snippets, placeholders, API identifiers, or intentional native words merely because they match
English. Resource tests verify bundle coverage, English keys, translator comments and placeholder names.

These are standalone libraries; no VS Code host is needed. Locale selection remains per request,
using case-insensitive exact locale tags and English fallback for unsupported tags. The formatter
has no separate messages and uses the parser's localized errors. The compatibility adapter selects
the bundle before calling `l10n.t` for interpolation, rather than calling process-global
`l10n.config`. Package-name comments namespace those formatting calls so ordinary host bundles
do not translate the selected text again. Hosts must not define matching
`<selected message>/@microsoft/powerquery-parser` or
`<selected message>/@microsoft/powerquery-language-services` keys in their global bundle.

Formatting follows `l10n.t`: all occurrences of a placeholder are replaced, replacement text is
literal (including `$&` and braces), and unmatched placeholders remain visible. The general-purpose
`StringUtils.assertGetFormatted` API remains unchanged for existing callers, but localization no
longer uses it. Dynamic locale-selected messages are maintained in the bundles directly; running
`l10n-dev` extraction on these adapters will not reconstruct the catalogs.

Run root `npm run lint`, `npm run build`, `npm test`, and `npm run validate:release` after changes.
The last command checks required bundles and template APIs, rejects obsolete template resources,
and exercises localized messages in an isolated tarball consumer.

## Release preparation

All three packages share a version, with exact internal dependencies. Set a specific version:

```powershell
npm run version:set -- <version>
```

Or increment the shared patch version:

```powershell
npm run version:patch
```

Update each package's `CHANGELOG.md` for the new version and review the manifest and lockfile
changes. Then build and validate the release:

```powershell
npm ci --ignore-scripts
npm run clean
npm run build
npm run lint
npm test
npm run validate:release
```

Packaging requires existing build outputs and never builds, commits, tags, pushes, or publishes.
`validate:release` packs and validates the release; use `pack:release` when only packaging is needed.
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
