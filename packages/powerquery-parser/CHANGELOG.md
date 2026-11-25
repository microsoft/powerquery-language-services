# Changelog

## Unreleased

- Changed: Lexing and parsing use a fresh five-second deadline by default. Supply a cancellation token to override it, or use `NoOpCancellationToken` to opt out.
- Fixed: Normalize hexadecimal numeric literal types correctly, including signed literals.

## 5.1.0

- Fixed: Accept non-null argument types for anynonnull function parameters. ([#349](https://github.com/microsoft/powerquery-language-services/pull/349))
- Fixed: Require target fields and respect record/table openness when checking structural type compatibility. ([#349](https://github.com/microsoft/powerquery-language-services/pull/349))
- Fixed: Accept defined lists where the primitive list type is expected, including nested lists and table cells. ([#349](https://github.com/microsoft/powerquery-language-services/pull/349))
- Fixed: Preserve nullability when extended types are absorbed by their primitive types during union simplification. ([#350](https://github.com/microsoft/powerquery-language-services/pull/350))
- Fixed: Distinguish open and closed defined records and tables when comparing types and simplifying unions. ([#350](https://github.com/microsoft/powerquery-language-services/pull/350))
- Fixed: Check every source union alternative for type compatibility, allowing matching union-typed table rows. ([#333](https://github.com/microsoft/powerquery-language-services/pull/333))
- Fixed: Preserve logical literal alternatives and their nullability when simplifying types and unions. ([#330](https://github.com/microsoft/powerquery-language-services/pull/330))
- Fixed: Allow non-nullable action, binary, date, datetime, datetimezone, duration, and time types where their nullable counterparts are expected, including table rows. ([#329](https://github.com/microsoft/powerquery-language-services/pull/329))

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
