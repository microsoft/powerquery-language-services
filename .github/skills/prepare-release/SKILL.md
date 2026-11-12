---
name: prepare-release
description: Prepare an independently versioned Power Query package release. Use when asked to increment or bump a package version, prepare release notes, or prepare a major, minor, or patch release.
---

<!-- markdownlint-disable -->

# Prepare a Power Query package release

Work from the monorepo root with installed root workspace dependencies and Node satisfying
the root package's engines. Use the root lockfile; do not install per package or use npm link.
This workflow prepares source files only. Never stage, commit, tag, push, or publish.

## Select the package and increment

Resolve the requested package and increment; clarify either if unspecified. Accepted identifiers:

- `powerquery-parser` or `@microsoft/powerquery-parser`
- `powerquery-formatter` or `@microsoft/powerquery-formatter`
- `powerquery-language-services` or `@microsoft/powerquery-language-services`

Use `major` for breaking public-contract changes, `minor` for backward-compatible additions,
and `patch` for backward-compatible fixes. Surface mismatches between the requested increment
and the documented impact rather than silently changing the user's selection.

## Prepare and review release-note wording

Read the selected package's changelog, applicable repository guidance, and relevant changes
before proposing or editing notes. Preserve user-authored wording unless accuracy, clarity,
or repository conventions require an edit.

Prepare supported entries under exactly one `## Unreleased` heading. Prefix every entry with
exactly one of `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`.
Style illustration only, not a claim about this release:

```markdown
## Unreleased

- Fixed: Preserve comments when formatting nested expressions.
```

Describe observable consumer impact briefly in plain language. Identify the affected public
API or scenario when useful. Avoid commit-message dumps, internal implementation trivia,
vague "improvements," marketing, and unverified performance assertions. Use neutral technical
prose in committed notes, not agent conversational affectations.

Include package-behavior changes only. Omit contributor-only documentation, tests, CI,
refactors, and dependency-only updates unless they change published behavior. Do not duplicate
the same impact across entries or infer changes from version numbers.

Call out breaking changes explicitly: explain the old/new contract and migration action
when supported by the actual changes. Do not invent compatibility guarantees, migration
instructions, or security details. If no entries are supported, stop and explain the missing
release content; do not fabricate notes or bypass the empty-section guard.

## Invoke the release command

Supply exactly one project and one increment:

```powershell
npm run release:prepare -- powerquery-parser major
npm run release:prepare -- powerquery-formatter minor
npm run release:prepare -- powerquery-language-services patch
```

Run only the selected invocation, not all examples. The script preflights metadata, lock
consistency, and changelog structure. It then runs full repository lint, build, and tests
sequentially, including parser resource tests and release-helper tests. Existing working-tree
edits participate in these gates; do not clean, stash, reset, auto-fix, or bypass failures.

The script uses the selected package's current version and `semver.inc` semantics, including
prerelease-to-stable promotion. The UTC date is captured once per invocation. It replaces
`## Unreleased` with `## <version> - <YYYY-MM-DD>`, preserving entries verbatim and removing
the Unreleased heading without recreating it. Editorial work belongs before invocation.
Missing, empty, malformed, duplicate, or ambiguous sections and duplicate release versions fail.

Let the script compute the date/version heading and update manifests and the root lockfile.
Do not hand-edit these values or separately invoke legacy `version:set` / `version:patch`.
Only the selected package's version increases; the private root stays unchanged. Exact direct
dependent pins follow the selected version: parser affects formatter/services, formatter
affects services, services affects no other package. Tags are per package: stable `latest`,
prerelease `next`.

The lock refresh uses npm's package-lock-only/ignore-scripts mechanism in an isolated copy
and rejects unrelated lock churn. Finally `npm run validate:release` packs all three local
tarballs and checks the prepared set in an isolated consumer. This all-package compatibility
check is not an all-package publication instruction.

## Handle failure and review the result

On failure, report the actual failing gate or preparation operation without claiming release
success. Do not repair unrelated files or bypass gates. Release-source edits owned by the
invocation are restored after later failures; detected concurrent edits are preserved and
rollback conflicts are reported explicitly. Build/test/pack artifacts are outside this
transaction, which is not crash-atomic. Preserve conflicted files for human review.

On success, review the final dated notes against their original meaning, verify the intended
package/increment, and check manifest, dependency-pin, tag, and lockfile scope. Unselected
versions and changelogs must remain unchanged. Report the package, old/new versions, date,
and affected files. Dependent pin edits without dependent version bumps are preparation
changes, not permission to republish unchanged versions; dependents need their own release
preparation before publication. Do not alter unrelated files, stage, commit, or publish.
