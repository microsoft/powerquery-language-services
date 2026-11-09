<!-- markdownlint-disable -->

# Changelog

## Unreleased

- Changed: Defer non-English diagnostic/documentation bundle loading and template construction
  until first use, caching results without changing synchronous locale APIs.
- Fixed: Complete localized parameter-documentation headings and restore unknown-name diagnostics
  from existing locale resources, retaining intentional technical terms.
- Changed: Use `@vscode/l10n` bundles and formatting for validation and parameter documentation while
  retaining per-request locales, translations, and existing TypeScript template APIs.
- Removed: Remove obsolete template JSON/LCX resources, localization manifests and their build generation;
  l10n bundles are the only translation resources. Preserve template APIs through code-defined
  bundle-key lookups without a separate English JSON catalog.
- Fixed: Correct malformed placeholder names in Galician, Portuguese (Portugal), and Serbian (Cyrillic)
  diagnostic translations so all arguments are substituted.
- Fixed: Replace repeated placeholders and treat replacement text literally.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
