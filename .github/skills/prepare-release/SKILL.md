---
name: prepare-release
description: Prepare a shared Power Query package release by choosing and applying the version, auditing consumer-facing changes since the previous release, finalizing every package changelog, and validating the release artifacts. Use when asked to prepare, stage, or review a release.
---

# Prepare a release

Prepare the repository for review. Do not commit, create a Git tag, push, publish packages, or create
a GitHub release unless the user explicitly requests that separate release action.

All three public packages share one version and use exact internal dependencies. Run release commands
from the repository root and use the existing release tooling rather than editing package manifests or
the lockfile by hand.

## Establish the release

1. Check the worktree status and preserve unrelated changes.
2. Find the latest release tag reachable from `HEAD`, using tags named `v<SemVer>`. Confirm that it is
   an annotated tag and use its target as the change-review baseline.
3. Determine the target version. Use a version supplied by the user. Otherwise increment the shared
   patch version.
4. Confirm that the target is valid full SemVer, is greater than the current shared package version,
   and does not already have a local or remote `v<version>` tag.

The expected source tag is `v<version>`. Report it in the final handoff, but do not create it during
release preparation. A release tag must point to the finalized, validated release commit, not an
earlier preparation commit.

## Audit the changelogs

Before editing, copy every entry currently under each `Unreleased` heading. Move those entries into the
new version section verbatim, preserving their text and order. Do not rewrite, combine, or silently
drop an existing entry. Flag a questionable existing entry in the final handoff instead.

Review the commits and diff from the previous release tag through `HEAD`. Inspect the associated pull
request or implementation when a title does not establish consumer impact. Classify each applicable
change by the package whose published behavior or contract changed:

- `packages\powerquery-parser`
- `packages\powerquery-formatter`
- `packages\powerquery-language-services`

Add a missing entry only for an observable downstream-consumer or user-facing change. Include public
API and type behavior, parsing or formatting behavior, diagnostics and editor features, runtime
requirements, security fixes, packaging, exports, and runtime dependency changes when applicable.
Exclude tests, CI, documentation, refactoring, code style, development tooling, and dependency-only
maintenance that does not change the published package.

After reviewing the full change set, assess the SemVer level independently of the selected target.
Recommend a minor version for backward-compatible new functionality and a major version for breaking
consumer changes. Explain the reason and ask before changing from the default patch version; do not
silently promote the release.

Use exactly one existing category prefix for every added consumer-facing entry: `Added`, `Changed`,
`Deprecated`, `Removed`, `Fixed`, or `Security`. Keep new text brief and describe the observable result
rather than the implementation or pull request title. End each newly written consumer-facing entry
with its GitHub pull request reference in the form `(#<number>)`. Do not add references to entries
copied from `Unreleased`, because those entries must remain verbatim. The generated `Updated package
dependencies` and `Version change only` entries do not need pull request references.

Finalize all three changelogs:

- Replace `## Unreleased` with `## <version>` when it exists.
- Otherwise insert `## <version>` above the previous release.
- If a package has no direct consumer-facing change but its published package dependencies changed,
  add `- Changed: Updated package dependencies.`
- If the package has neither consumer-facing changes nor package dependency changes, add
  `- Version change only`
- Remove the `Unreleased` heading for the prepared release.
- Keep prior release sections unchanged and in descending version order.

After editing, compare the final entries with the saved `Unreleased` entries and confirm that every
saved line appears verbatim under the new version.

## Apply the shared version

For an explicit version, run:

```powershell
npm run version:set -- <version>
```

Run `npm run version:patch` when the user did not provide an exact version. Review all package
manifests and `package-lock.json`. Confirm that:

- every public package has the target version;
- internal package dependencies use that exact version;
- stable releases use the `latest` npm dist-tag;
- prereleases use the `next` npm dist-tag;
- no unrelated dependency or metadata changes were introduced.

## Validate and hand off

Use the repository's release sequence:

```powershell
npm ci --ignore-scripts
npm audit --omit=dev --audit-level=low
npm audit --audit-level=high
npm run clean
npm run build
npm run lint
npm test
npm run validate:release
```

Require the production dependency audit to complete successfully with zero vulnerabilities at every
severity. Require the full dependency audit to have no high or critical vulnerabilities, and review
and report any lower-severity development-only findings. Do not run `npm audit fix` during release
preparation because it can introduce unrelated or breaking dependency changes.

An audit service, registry, authentication, rate-limit, or network error is not a clean audit. Report
the blocker and rerun through the approved registry before declaring the release ready.

Inspect `dist\release-manifest.json` and confirm the release version, source commit, package order,
dist-tags, internal dependency closure, and three tarballs match the prepared release. Do not treat
generated `dist` contents as source changes to commit.

Return the target version, previous release tag, expected new tag, changelog entries added or flagged,
audit results, validation results, and the remaining release actions. The remaining actions normally
include merging the preparation change, validating the final release commit, creating the annotated
`v<version>` tag, and then using the approved publication and GitHub release process.
