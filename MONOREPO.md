<!-- markdownlint-disable -->

# Contributing and release contract

## Workspace and source provenance

`packages/powerquery-parser`, `packages/powerquery-formatter`, and
`packages/powerquery-language-services` are the explicit release allowlist, in dependency order.
The private repository root is orchestration only. Each public package retains its own runtime
dependencies, compiler safety options, README, and license. Parser specification/style documents
and its NOTICE are retained. Package `files` allowlists exclude tests, samples, and benchmarks.

Parser and formatter were imported with unsquashed Git subtree merges. Language services was moved
within its existing history. The structural import commits preserve each complete `src` tree
exactly; [source provenance](source-provenance.json) records the upstream commits, versions, tree
identities, registry observation, and pending dependency PR inventory at freeze.
No POC branch or pending Dependabot commit is an import source.

The initial version is `(highest frozen source major + 1).0.0`, hence 5.0.0 for parser 4.0.1,
formatter 1.1.0, and services 1.3.0. The migration introduces no functional runtime changes.
The formatter's benchmark test resolves `ts-node/register` through Node instead of assuming a
package-local install; this is the sole intentional source-tree adjustment for workspace hoisting.

Pending dependency PRs stay separate from the migration. Dependency resolutions required by the
single new lockfile are reviewed here, not cherry-picked wholesale from pending PRs. Formatting
tool versions are pinned to each frozen lockfile to prevent unrelated source reformatting;
formatter retains its legacy ESLint/Prettier stack. The parser's `serialize-javascript` override
is enforced at the only effective override scope: the root manifest.

## Builds, tests, and editors

Use Node 22.15.0 and npm 11.5.2; package consumers continue to require only Node >=22.
Run `npm ci --ignore-scripts` at the root. No lifecycle hook is required for the documented
commands. `npm run build` builds dependencies explicitly before dependents. `clean` removes only
owned package `lib` directories, buildinfo files, and test reports, never contributor source or
installed dependencies. Repeated clean/build must produce complete JavaScript, declarations,
and runtime JSON assets. TypeScript normalizes JSON whitespace on emission; validation compares every
localized message to source and requires tarball bytes to match the emitted runtime assets.

`npm test` runs the three unit suites, parser resources, and release helper regression tests.
The four package JUnit reports are:

- `packages/powerquery-parser/test-results.xml`
- `packages/powerquery-parser/test-results-resources.xml`
- `packages/powerquery-formatter/test-results.xml`
- `packages/powerquery-language-services/test-results.xml`

`npm run test:reports` rejects missing, empty, or failed reports. Workspace tests run with their
package as the working directory so existing fixture-relative paths keep working. Root VS Code
tasks/debug configurations select that same directory and use the root tools. ESLint projects
are anchored to their configuration directories; do not prepend workspace paths twice.
Build dependencies once before running a package's watch, benchmark, or focused test command.
Package-specific benchmark/node-dump/recursive-format entry points remain available.

## Version preparation

`npm run version:set -- <V>` accepts a complete SemVer and prepares the fixed release group.
All package versions and every internal runtime dependency must equal `V` exactly. No wildcards,
workspace protocols, path dependencies, or external registry fallback are permitted internally.
The command updates the root lock with lifecycle scripts disabled and validates the release set.
It must fail if lock regeneration fails. Review the resulting manifest/lock diff normally.
It does not create commits, tags, pushes, or publications.

Stable versions use `publishConfig.tag: latest`; prereleases use `next`. Maintainers must verify
public registry version absence and current published baselines again before releasing: the
configured-proxy observation is not authoritative public registry evidence or a permanent reservation.
Direct public-registry access is blocked in the implementation environment; restores and metadata
checks use the existing configured npm proxy. Maintainers must verify authoritative publication
state through their approved release process. Apply the highest semantic bump needed
by any member to the whole group; an unchanged package still gets the new group version.

## Packaging and isolated validation

Prerequisites for `npm run pack:release` and `npm run validate:release` are a root locked restore
and completed ordered build. Lint and the complete test command are separate release gates.
Neither packaging command restores workspaces or builds implicitly. `pack:release` packs the
already-built explicit set with hooks disabled, validates tarball metadata and contents, and emits:

```text
dist/
  npm/powerquery-parser/<actual-npm-pack-filename>.tgz
  npm/powerquery-formatter/<actual-npm-pack-filename>.tgz
  npm/powerquery-language-services/<actual-npm-pack-filename>.tgz
  release-manifest.json
```

There is exactly one tarball per package directory. Metadata inside each tarball is the authority;
filenames are taken from `npm pack --json`, not guessed. Manifest `schemaVersion` is 1,
`releaseVersion` is the common full SemVer, and `sourceCommit` is the repository's Git HEAD.
The `packages` array is parser, formatter, services order. Each entry has `name`, `version`,
`workspace`, `tarball`, SHA-512 SRI `integrity`, exact `internalDependencies`, and `distTag`.

`workspace` is relative to the repository root. **`tarball` is relative to `dist`, the directory
containing the manifest**, not relative to the repository root or package. Both are safe portable
slash-separated paths; artifact relocation preserves their meaning. Private configuration,
credentials, source checkouts, and publishing infrastructure are not part of this contract.

`validate:release` additionally installs all three local artifacts together in a temporary
consumer outside the monorepo. It loads entry points, exercises representative APIs and supported
deep imports, and type-checks against the installed declarations without workspace resolution.
The consumer is cleaned up on completion/failure. This validates package completeness, not npm
publication, registry propagation, or every downstream editor integration.
The consumer uses the user's existing configured npm registry/proxy and authentication settings,
without copying those settings into the repository, tarballs, or release manifest. It clears
module injection settings and cannot resolve workspace links. Proxy-visible metadata is distinct
from authoritative public publication state. Root `.npmrc` omits registry-resolved URLs from the
lockfile, preserving package versions/integrities without committing private feed addresses.
For authoritative release evidence, run against a clean committed checkout; a local dirty run
still records HEAD and cannot attest uncommitted changes.

## CI and owner-managed transition

GitHub Actions runs the locked restore, lint, two clean builds, all tests, report validation, and
packed-consumer checks on Windows and Linux with read-only repository permissions. It retains
package/test artifacts for diagnostics only and contains no publishing credentials or publisher.
Dependabot now uses the root npm lockfile and the root GitHub Actions configuration.

The old public Azure DevOps YAML is retired with maintainer authorization. Its build, tests,
JUnit collection, and package artifact responsibilities are replaced by the GitHub job.
PoliCheck and its logs are **not** reproduced by a generic npm check; owners must explicitly retire
or separately replace that legacy requirement. Required compliance scans remain an owner-managed
release responsibility, not a claim made by this workflow.

Before merging, repository owners must update branch protection/rulesets to require the active
`build-and-test (windows-latest)` and `build-and-test (ubuntu-latest)` jobs, and retire/remap
the old `build-and-test`, `Mocha Tests`, and Azure DevOps statuses as applicable. Deleting YAML
does not change live check policies, registered pipeline definitions, or queued jobs; no live
policy was changed by this migration.

The broken localization pipelines are retired, but all checked-in translations/runtime JSON are
preserved. Localization automation replacement, source-repository relocation notices/archival,
downstream rollout, and any publication require separate owner action and approval.
