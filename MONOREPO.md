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
formatter retains its legacy ESLint/Prettier stack. The merged upstream audit remediation
([microsoft/powerquery-parser#438](https://github.com/microsoft/powerquery-parser/pull/438),
[microsoft/powerquery-formatter#101](https://github.com/microsoft/powerquery-formatter/pull/101),
and #312) is incorporated
as a separately recorded history-preserving integration after the original freeze.
It upgrades Mocha to 12.0.3 or later, replaces the obsolete third-party reporting packages
with each upstream's composite built-in Spec/XUnit reporter, and removes the obsolete
`serialize-javascript` override so the remediated dependency graph resolves normally.
The package source majors did not change, so the initial shared version remains 5.0.0.
The final parser follow-up
[microsoft/powerquery-parser#439](https://github.com/microsoft/powerquery-parser/pull/439)
corrects its GitHub job to Node 22; the monorepo Windows job selects Node from the root manifest's
supported `engines.node` range.
That commit is also retained in the merged upstream history.

The post-integration npm audit reports eight moderate development-dependency findings rooted
in [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249);
there are no high or critical findings. The same affected minimatch 10.2.6 dependency paths
remain in the merged upstream remediation. A breaking dependency override or Mocha downgrade
is not part of this migration; this residual finding needs a separately reviewed tooling fix.

## Builds, tests, and editors

Use Node matching the root `engines.node` range (currently >=22) and its bundled npm.
GitHub Actions uses `node-version-file: package.json`, so the selected version follows that range,
not an exact patch or a separate hardcoded CI major. `>=22` also permits later supported majors;
it is not equivalent to `22.x`. Package consumers retain the same Node >=22 floor.
The initial lockfile was generated with npm 11.5.2, but no feature requires that exact version.
Locked restores and reviewed lockfile diffs provide dependency reproducibility without enforcing
an unrelated Node patch or npm version in release helpers.
Run `npm ci --ignore-scripts` at the root. No lifecycle hook is required for the documented
commands. `npm run build` builds dependencies explicitly before dependents. `clean` removes only
owned package `lib` directories, buildinfo files, and test reports, never contributor source or
installed dependencies. Repeated clean/build must produce complete JavaScript, declarations,
and runtime JSON assets. TypeScript normalizes JSON whitespace on emission; validation compares every
localized message to source and requires tarball bytes to match the emitted runtime assets.

`npm test` runs the three unit suites, parser resources, and release helper regression tests.
Mocha's composite Spec/XUnit reporters retain readable console output and the same four
JUnit-compatible report paths; parser resources still have their distinct output:

- `packages/powerquery-parser/test-results.xml`
- `packages/powerquery-parser/test-results-resources.xml`
- `packages/powerquery-formatter/test-results.xml`
- `packages/powerquery-language-services/test-results.xml`

Actions collects reports using `packages/**/test-results*.xml`, including both parser suites,
and fails the upload if no reports match. Test failures still fail `npm test`; there is no
separate exact-path/count check. Report collection runs after test failures as well.
Workspace tests run with their
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

## CI and retired automation

GitHub Actions runs the locked restore, lint, two clean builds, all tests, report collection, and
packed-consumer checks on `windows-latest`, matching all three frozen upstream GitHub workflows,
with read-only repository permissions. The existing `build-and-test` job identity is retained;
there is no additional operating-system matrix or acceptance gate. It retains
package/test artifacts for diagnostics only and contains no publishing credentials or publisher.
The `diagnostic-packages` artifact includes `dist/npm/**/*.tgz` and `dist/release-manifest.json`
from the existing validation step. These are the three actual npm tarballs (`.tgz`, not renamed
`.tar` files); no extra build or packaging pass is introduced.
Dependabot now uses the root npm lockfile and the root GitHub Actions configuration.

All public Azure DevOps pipeline definitions were confirmed dead code by the maintainer and
removed, including the imported parser/formatter definitions and broken localization pipelines.
Their historical checks and artifact tasks are not migration prerequisites. Normal active
validation is provided by GitHub Actions; no live policy or pipeline configuration is changed.

The broken localization pipelines are retired, but all checked-in translations/runtime JSON are
preserved. Localization automation replacement, source-repository relocation notices/archival,
downstream rollout, and any publication require separate owner action and approval.
