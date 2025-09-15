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

- Test files in `src\test\files\`
- Follow existing mocha patterns and style conventions

## Development Guidelines

- Try to maintain backwards compatibility for library consumers
    - If an important improvement will break backwards compatibility, notify the user before making this change
- Follow existing code patterns and style
- Use .copilot-journal.md for task-specific tracking
- When generating markdown file, include `<!-- markdownlint-disable -->` at the top of the file to avoid markdown linting issues

## 🔧 Code Quality Requirements

### ESLint & Prettier Compliance

**IMPORTANT**: This repository uses strict ESLint and Prettier rules. Follow these during code generation:

#### ESLint Rules to Follow:

- Use `const` for immutable values, `let` for mutable
- Prefer arrow functions for simple expressions
- Add type annotations for function parameters
- Use `async/await` over Promises where possible
- No `any` types - use proper TypeScript typing
- Import sorting: external modules first, then relative imports

#### Prettier Formatting:

- 4-space indentation
- Double quotes for strings
- Trailing commas in objects/arrays
- Line length limit: 120 characters

#### Common Patterns:

```typescript
// ✅ Good
const result: ValidationResult = await validate(settings, document);
const diagnostics: Diagnostic[] = result.diagnostics;

// ❌ Avoid
var result = await validate(settings, document);
let diagnostics = result.diagnostics;
```

### File Organization

- Keep optimization code in separate, well-named files
- Use clear interfaces for new data structures
- Document complex algorithms with inline comments
- Follow existing naming conventions (`tryX`, `assertX`, etc.)

---

## 🚨 **CRITICAL: GIT & BRANCH MANAGEMENT PROTOCOL**

### **🔒 MANDATORY PROTOCOL - NEVER VIOLATE**

Based on critical incidents during optimization work, the following protocol is **MANDATORY** for all Copilot operations:

#### **❌ NEVER DO WITHOUT EXPLICIT USER REQUEST**:

- `git reset --hard`
- `git revert`
- Delete or reset branches
- Assume compilation issues require git resets
- Discard uncommitted work or changes

#### **✅ ALWAYS DO**:

- **ASK THE USER** before any destructive git operations
- **RESOLVE ISSUES IN PLACE** rather than reverting work
- **COMMUNICATE PROBLEMS** and ask for guidance when encountering file/git issues
- **PRESERVE WORK** - optimization progress and development work is valuable and should never be lost without explicit instruction
- **Commit progress frequently** when working on complex optimizations

#### **🔧 Problem Resolution Strategy**:

- If encountering compilation errors: Fix the errors in place, don't reset
- If encountering git conflicts: Ask user for guidance on resolution approach
- If uncertain about file state: Ask user to clarify rather than making assumptions
- If build fails: Identify specific issues and fix them rather than reverting
