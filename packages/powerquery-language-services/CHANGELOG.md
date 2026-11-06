<!-- markdownlint-disable -->

# Changelog

## Unreleased

- Complete localized parameter-documentation headings and restore unknown-name diagnostics
  from existing locale resources, retaining intentional technical terms.
- Use `@vscode/l10n` bundles and formatting for validation and parameter documentation while
  retaining per-request locales, translations, and existing TypeScript template APIs.
- Remove obsolete template JSON/LCX resources, localization manifests and their build generation;
  l10n bundles are the only translation resources. Preserve template APIs through code-defined
  bundle-key lookups without a separate English JSON catalog.
- Correct malformed placeholder names in Galician, Portuguese (Portugal), and Serbian (Cyrillic)
  diagnostic translations so all arguments are substituted.
- Replace repeated placeholders and treat replacement text literally.

## 5.0.0

- Align the package version with the shared release version for the Power Query monorepo.
