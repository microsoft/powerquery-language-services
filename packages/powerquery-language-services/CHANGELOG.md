# Changelog

## Unreleased

- Fixed: Infer null for missing optional list items and table rows without suppressing errors in existing elements.
- Fixed: Null-coalescing type inference removes null alternatives from the left operand while preserving right operand nullability.
- Fixed: Infer null-coalescing results without propagating errors from an unreachable fallback.
- Fixed: Infer only the reachable branch of if expressions with literal true or false conditions, including parenthesized literals.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
