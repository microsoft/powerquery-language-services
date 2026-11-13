# Changelog

## Unreleased

- Fixed: Check every source union alternative for type compatibility, allowing matching union-typed table rows.
- Fixed: Preserve logical literal alternatives and their nullability when simplifying types and unions.
- Fixed: Allow non-nullable action, binary, date, datetime, datetimezone, duration, and time types where their nullable counterparts are expected, including table rows.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
