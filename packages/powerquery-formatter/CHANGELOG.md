<!-- markdownlint-disable -->

# Changelog

## Unreleased

- Lexical and parse errors returned by `tryFormat` inherit the parser's migration to
  `@vscode/l10n`. The formatter's locale setting and formatting behavior are unchanged;
  no formatter-specific localization code or dependency is added.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
