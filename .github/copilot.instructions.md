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

## Changelog

- Update the `CHANGELOG.md` for each affected package only when a change impacts package users or downstream
  consumers.
- Do not add entries for dependency-only updates or contributor-focused changes such as documentation, tests, CI,
  refactoring, or development tooling unless they change published package behavior.
- Prefix every entry with exactly one of: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`.
- Keep entries brief and describe the observable consumer impact.
- Put entries under `Unreleased` when the change does not include a version bump.
- When bumping the shared package version, move all `Unreleased` entries into the new version section and remove the
  `Unreleased` section.
