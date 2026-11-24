# Power Query Language Services Instructions

## Repository

This npm monorepo contains three publishable TypeScript packages:

- `packages/powerquery-parser`: lexing, parsing, ASTs, types, and shared utilities.
- `packages/powerquery-formatter`: formatting expressions and section documents.
- `packages/powerquery-language-services`: IntelliSense and editor language features.

Work from the repository root. Use the root lockfile and workspace scripts; do not run per-package installs or use
`npm link`.

## Changes

- Preserve backward compatibility for downstream consumers. Call out a necessary breaking change before
  implementing it.
- Follow nearby code and test patterns. Prefer focused changes over unrelated cleanup.
- Keep runtime dependencies in the package that uses them. Shared development tooling belongs in the root package.
- Let TypeScript, ESLint, and Prettier configuration define code style instead of duplicating those rules here.
- Do not add task journals, scratch notes, or other temporary artifacts to the repository.
- Preserve existing work. Do not discard changes or perform destructive Git operations unless the user explicitly
  requests them.

## Validation

Use the smallest relevant workspace test while developing. For repository-wide changes, use the root commands:

```powershell
npm run build
npm run lint
npm test
```

Run `npm run validate:release` after building when changing package metadata, exports, release tooling, or other
packaged-consumer behavior.

### Blocking validation findings

- When changing a test expectation, justify the new result from the behavior being tested, not from the current
  implementation's output. For type inference, use the most precise result the contract supports; a test must not
  reject a correct, more precise result.
- Treat a review or audit finding that an assertion accepts incorrect behavior or rejects correct behavior as a
  validation blocker, not optional cleanup. Fix the code or test and rerun the affected cases, or show with
  independent evidence why the finding does not apply. Green CI running the disputed assertion is not that evidence.
- While the finding is open, report the affected branch and assertion and withhold ordinary commits and pushes for
  that branch, including comments-only follow-ups. A routine commit or push request does not waive the blocker.
  An explicitly authorized forced checkpoint records the unresolved finding; it does not mark the change validated.

## Changelog

- Do not update package changelogs as part of routine changes unless explicitly requested. Changelogs are
  maintained during release preparation.
- Prefix every entry with exactly one of: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`.
- Keep entries brief and describe the observable consumer impact.
- Put entries under `Unreleased` when the change does not include a version bump.
- When bumping the shared package version, move all `Unreleased` entries into the new version section and remove the
  `Unreleased` section.
