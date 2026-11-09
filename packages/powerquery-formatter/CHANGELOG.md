<!-- markdownlint-disable -->

# Changelog

## Unreleased

- Changed: Unused non-English parser diagnostic bundles load only on first message access,
  reducing eager localization work without changing formatter settings or behavior.
- Changed: Lexical and parse errors returned by `tryFormat` inherit the parser's migration to
  `@vscode/l10n`. The formatter's locale setting and formatting behavior are unchanged;
  no formatter-specific localization code or dependency is added.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
