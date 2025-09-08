# PowerQuery Language Services Local Instructions

## Project Overview

This package provides intellisense functionality for the Power Query / M language. It is consumed through:

- Applications using `monaco-editor`
- VS Code Language Server Protocol extension

## Current Development Focus

- Improving async processing of validation code path
- Enhancing cancellation token support for large file validation
- Addressing performance issues with large M documents

## Key Architecture Points

### Validation System

- Main validation logic in `src\powerquery-language-services\validate\validate.ts`
- ValidationSettings includes cancellationToken support
- Current implementation has synchronous bottlenecks preventing effective cancellation
- Performance degrades significantly with large files (30+ seconds for complex documents)

### Testing Patterns

- Validation tests located in `src\test\validation\`
- Common utilities in `src\test\testUtils\validationTestUtils.ts`
- Test files for validation in `src\test\files\`
- Follow existing mocha patterns and style conventions

### Critical Files for Async Validation Work

- `src\powerquery-language-services\validate\validate.ts` - Main validation logic
- `src\powerquery-language-services\validate\validationSettings.ts` - Settings interface
- `src\powerquery-language-services\analysis\` - Analysis utilities used by validation
- `src\powerquery-language-services\inspection\` - Type inspection system

## Development Guidelines

- Maintain backward compatibility
- Ensure cancellation is graceful and doesn't leave inconsistent state
- Follow existing code patterns and style
- Add comprehensive tests for async behavior
- Use .copilot-current-task.md for task-specific tracking

## Common Issues

- Large M documents (like Kusto.pq example) take 30+ seconds to validate
- Cancellation tokens not effectively checked during validation processing
- Synchronous operations block proper async flow

## Testing Strategy

- Create complex test documents that demonstrate performance issues
- Test cancellation behavior with long-running validation
- Ensure existing validation functionality remains intact
- Measure performance improvements after async enhancements
