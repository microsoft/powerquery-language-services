<!-- markdownlint-disable -->

# Changelog

## Unreleased

- Use `@vscode/l10n` bundles and named-placeholder formatting while preserving per-request locales,
  English fallback, custom template objects, and published TypeScript localization APIs.
- Remove per-locale ID-keyed JSON deep imports and duplicate generated resources; use l10n bundles
  or template APIs instead. Retain the English key catalog required by the runtime adapter and types.
- Replace every occurrence of a placeholder without interpreting replacement text as a substitution pattern.

## 5.0.0

- Align the package version with the shared release version for the Power Query monorepo.
