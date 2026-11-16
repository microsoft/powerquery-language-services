# Changelog

## Unreleased

- Fixed: Preserve nullability when extended types are absorbed by their primitive types during union simplification.
- Fixed: Distinguish open and closed defined records and tables when comparing types and simplifying unions.
- Fixed: Check every source union alternative for type compatibility, allowing matching union-typed table rows.
- Fixed: Preserve logical literal alternatives and their nullability when simplifying types and unions.
- Fixed: Allow non-nullable action, binary, date, datetime, datetimezone, duration, and time types where their nullable counterparts are expected, including table rows.

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
