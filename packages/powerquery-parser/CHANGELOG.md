<!-- markdownlint-disable -->

# Changelog

## Unreleased

- Changed: Load non-English diagnostic bundles and construct templates on first message access,
  reusing cached results while preserving synchronous APIs and named locale exports.
- Changed: Use `@vscode/l10n` bundles and named-placeholder formatting while preserving per-request locales,
  English fallback, custom template objects, and published TypeScript localization APIs.
- Removed: Remove obsolete template JSON/LCX resources, localization manifests and duplicate generated assets;
  use l10n bundles or template APIs instead. Preserve public IDs/types with code-defined bundle-key
  lookups rather than an English JSON catalog.
- Fixed: Replace every occurrence of a placeholder without interpreting replacement text as a substitution pattern.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
