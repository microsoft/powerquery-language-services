# Changelog

## 5.1.0

- Fixed: Infer annotated function returns from uncertain bodies and nullable results while preserving compatible type detail. (#347)
- Fixed: Infer projections of undeclared fields from open records without failing type inspection. (#346)
- Fixed: Infer selected list items directly from range bounds without expanding ranges, including large ranges, aliases, and nested lists. (#348)
- Fixed: Infer handlerless try expressions as records rather than unions with their protected values. (#354)
- Fixed: Infer binary operations over union alternatives while retaining invalid-operation alternatives. (#337)
- Fixed: Infer non-nullable logical results for equality and inequality across value kinds, including null. (#337)
- Fixed: Infer table column selections as lists, preserving exact elements when rows are known. (#334)
- Fixed: Infer null for missing optional list items and table rows without suppressing errors in existing elements. (#335)
- Fixed: Null-coalescing type inference removes null alternatives from the left operand while preserving right operand nullability. (#332)
- Fixed: Infer null-coalescing results without propagating errors from an unreachable fallback. (#332)
- Fixed: Infer only the reachable branch of if expressions with literal true or false conditions, including parenthesized literals. (#338)
- Changed: Update the VS Code language server runtime dependencies. (#361)
- Fixed: Prevent overlapping semantic tokens from being returned. (#357)
- Added: Expose targeted and global invalidation for cached analyses. (#358)

## 5.0.0

- Changed: Align package version with the shared Power Query monorepo release.
