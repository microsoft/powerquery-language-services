<!-- markdownlint-disable -->

# PowerQuery Language Services Performance Optimization Project

## 🎯 Project Objective

Optimize the **scope inspection performance** in PowerQuery Language Services validation pipeline, specifically targeting complex connector files like `Kusto.pq` that currently take 75+ seconds to validate.

## 📊 Problem Statement

### Current Performance Issues
- **Validation bottleneck**: 99.98% of validation time is spent in scope inspection
- **Large connector files**: Complex files like `Kusto.pq` (>200KB) take 75+ seconds to validate
- **User experience impact**: Slow validation blocks real-time editing and IntelliSense

### Root Cause Analysis
The scope inspection system performs redundant calculations for:
- **Repeated scope patterns** in large files
- **Nested function definitions** with similar structures  
- **Complex let expressions** with multiple levels of nesting

## 🏗️ Solution Architecture - Phased Approach

### Phase 1: Infrastructure & Baseline ✅
- Establish performance measurement infrastructure
- Create comprehensive benchmark tests
- Document current performance baselines
- Set up regression detection

### Phase 2: Basic Memoization & Early Returns
- **Scope result caching**: Cache computed scopes by node ID
- **Early termination**: Skip unnecessary scope calculations for simple nodes
- **Cache management**: Implement cache size limits and cleanup strategies

### Phase 3: Advanced Optimizations  
- **Incremental scope updates**: Only recalculate changed portions
- **Pattern recognition**: Identify and optimize common PowerQuery patterns
- **Lazy evaluation**: Defer expensive scope calculations until needed

### Phase 4: Memory & Resource Management
- **Memory optimization**: Reduce memory footprint of cached data
- **Resource pooling**: Reuse expensive computation resources
- **Garbage collection**: Smart cleanup of unused scope data

## 🏛️ Repository Structure & Key Files

### Core Implementation Files
```
src/powerquery-language-services/
├── inspection/scope/
│   ├── scopeInspection.ts          # Main scope inspection logic - PRIMARY TARGET
│   ├── scope.ts                    # Scope type definitions
│   └── index.ts                    # Scope module exports
├── validate/
│   ├── validate.ts                 # Main validation entry point
│   ├── validateUnknownIdentifiers.ts  # Unknown identifier validation
│   └── validationSettings.ts      # Validation configuration
└── analysis/
    └── analysis.ts                 # Analysis orchestration
```

### Test Infrastructure
```
src/test/
├── validation/                     # Existing validation tests
├── testUtils/                      # Test utility functions
├── testConstants.ts                # Test configuration constants
└── files/                          # Test data files
```

## 🧪 Testing Strategy & Validation Process

### Baseline Testing Requirements

**CRITICAL**: Before implementing ANY optimizations, capture baseline diagnostic results to prevent regressions.

#### Existing Test Files That Need PerformanceTraceManager

**IMPORTANT**: The following test files currently have broken imports and will need to be updated once `PerformanceTraceManager` is recreated:

1. **`src/test/scope-optimization-baseline.test.ts`** - Main baseline performance testing
2. **`src/test/validation/scope-inspection-analysis.test.ts`** - Detailed scope operation analysis

These files contain comprehensive performance testing logic but are currently broken due to the missing `PerformanceTraceManager` import. Once the class is recreated, these tests will provide:
- Small/medium/large document performance baselines
- Detailed scope operation timing analysis
- Diagnostic accuracy validation
- Performance regression detection

#### Test Configuration
```typescript
export const baseValidationSettings: ValidationSettings = {
    ...StandardLibraryValidateAllSettings,
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: false,
    checkUnknownIdentifiers: true,
    library: StandardLibrary,  // REQUIRED: Prevents Table.AddColumn, etc. from being unknown
};
```

#### TypeStrategy Testing
Run all tests with BOTH type strategies and capture separate baselines:
- `TypeStrategy.Extended` - Full type inference (slower, more accurate)
- `TypeStrategy.Primitive` - Basic type handling (faster, less detailed)

#### Benchmark Test Structure
```typescript
describe("Performance Baseline Tests", () => {
    it("should measure Kusto.pq validation performance", async () => {
        // 1. Load Kusto.pq file content
        // 2. Test with TypeStrategy.Extended
        // 3. Test with TypeStrategy.Primitive  
        // 4. Capture diagnostic counts and content
        // 5. Measure and log timing data
    });
    
    it("should test medium complexity documents", async () => {
        // Synthetic test documents with known scope patterns
    });
    
    it("should test small documents for regression detection", async () => {
        // Simple cases that should remain fast
    });
});
```

### Validation API Usage

**IMPORTANT**: The `assertValidateDiagnostics` function **ALREADY EXISTS** in `src/test/testUtils/validationTestUtils.ts` and is working correctly.

```typescript
import { TestConstants, TestUtils } from ".";

const diagnostics: Diagnostic[] = await TestUtils.assertValidateDiagnostics({
    text: documentContent,
    analysisSettings: {
        ...TestConstants.StandardLibraryAnalysisSettings,
        inspectionSettings: {
            ...TestConstants.StandardLibraryInspectionSettings,
            typeStrategy: TypeStrategy.Extended, // or TypeStrategy.Primitive
        },
    },
    validationSettings: baseValidationSettings,
});
```

#### Additional Test Utilities in Git Stash

The git stash contains additional validation test utilities that were created during optimization work:

- `assertValidationError(result, expectedMessageContains, assertionMessage?)` - Assert validation returns specific error
- `assertValidationCancelled(result, assertionMessage?)` - Assert validation was cancelled
- `assertValidationSuccess(result, assertionMessage?)` - Assert validation succeeded  
- `assertValidationSuccessOrCancelled(result, onSuccess?, onCancelled?)` - Handle non-deterministic timing

These utilities are useful for comprehensive testing but are not essential for the core optimization work.

### Regression Prevention
- **Diagnostic comparison**: Exact diagnostic count and message matching
- **Performance bounds**: Ensure optimizations don't make anything slower
- **Memory monitoring**: Track memory usage during validation

## 📈 Performance Measurement Guidelines

### Timing Infrastructure
```typescript
// High-precision timing
const startTime: bigint = process.hrtime.bigint();
// ... perform validation
const endTime: bigint = process.hrtime.bigint();
const durationMs: number = Number(endTime - startTime) / 1000000;
```

### Baseline Capture Format
```typescript
interface PerformanceBaseline {
    documentSize: number;
    typeStrategy: "Extended" | "Primitive";
    validationTimeMs: number;
    diagnosticsCount: number;
    diagnosticsHash: string; // For regression detection
    scopeOperations?: number; // If measurable
}
```

### Success Metrics
- **Primary Goal**: Reduce Kusto.pq validation time from 75+ seconds to <10 seconds
- **Secondary Goals**: 
  - Maintain diagnostic accuracy (100% match)
  - Improve smaller documents by 10-30%
  - Keep memory usage reasonable (<2x current)

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

## 🚀 Implementation Workflow

### Current Implementation Status

#### Starting Fresh - No Optimizations Yet ⚠️

**IMPORTANT**: No optimizations have been implemented yet. The branch `dev/improveInspectionScope` is starting from a clean state.

- **Phase 1**: Infrastructure & Baseline - ❌ **NOT STARTED**
- **Phase 2**: Basic Memoization & Early Returns - ❌ **NOT STARTED**  
- **Phase 3**: Advanced Optimizations - ❌ **NOT STARTED**
- **Phase 4**: Memory & Resource Management - ❌ **NOT STARTED**

#### Current State
- `scopeInspection.ts` - No modifications made
- Performance baselines - Not established
- Test infrastructure - Needs to be created
- `PerformanceTraceManager` - Does not exist, needs to be created

### Step 1: Environment Setup
1. Create new branch from `master`
2. Install dependencies: `npm install`
3. Verify tests pass: `npm test`
4. Enable ESLint/Prettier in IDE

### Step 2: Baseline Establishment
1. Create comprehensive benchmark test suite
2. Run tests against Kusto.pq with both TypeStrategy values
3. Capture and document baseline performance data
4. Store baseline diagnostic results for regression detection

### Step 3: Phase 2 Implementation
1. Analyze `scopeInspection.ts` for optimization opportunities
2. Implement basic memoization for scope results
3. Add early returns for simple/leaf nodes
4. Implement cache size management
5. Validate no diagnostic regressions

### Step 4: Performance Validation
1. Re-run benchmark tests
2. Compare performance improvements
3. Verify diagnostic accuracy maintained
4. Document actual vs expected improvements

### Step 5: Iteration & Refinement
1. Profile remaining bottlenecks
2. Implement additional optimizations
3. Monitor memory usage and cache efficiency
4. Prepare for Phase 3 advanced optimizations

## 🎯 Phase 2 Specific Targets

### Primary Optimization Areas
1. **`tryNodeScope` function**: Main entry point for scope calculation
2. **`inspectScope` function**: Core scope building logic
3. **`inspectNode` function**: Per-node scope inspection

### Implementation Strategies
- **Node-level caching**: `Map<nodeId, NodeScope>` for computed scopes
- **Ancestry-based caching**: Cache scope chains for common patterns
- **Early exit conditions**: Skip processing for nodes with no scope impact
- **Cache eviction**: LRU or size-based cache management

### Expected Outcomes
- **Kusto.pq**: 75+ seconds → target <10 seconds (85%+ improvement)
- **Medium files**: 30-50% improvement
- **Small files**: 10-30% improvement  
- **Memory overhead**: <50% increase in peak memory usage

## 📚 Key Resources & References

### Scope Inspection Flow
1. `validate()` → validation pipeline entry
2. `tryNodeScope()` → scope calculation request
3. `inspectScope()` → builds scope through ancestry traversal  
4. `inspectNode()` → processes individual AST nodes
5. Returns `NodeScope` with identifier bindings

### Performance Profiling Infrastructure

#### PerformanceTraceManager Class - **NEEDS TO BE RECREATED**

**File**: `src/test/performanceTraceManager.ts` ❌ **DELETED - MUST RECREATE**

The `PerformanceTraceManager` class was created during optimization work but was accidentally deleted. It needs to be recreated in the new branch. Here's the complete implementation:

```typescript
// src/test/performanceTraceManager.ts
import { TraceManager, Trace, TraceConstant } from "@microsoft/powerquery-parser";

export interface OperationTiming {
    name: string;
    phase: string;
    task: string;
    id: number;
    correlationId?: number;
    startTime: number;
    endTime?: number;
    duration?: number;
    details?: any;
}

export interface TimingReport {
    totalOperations: number;
    totalDuration: number;
    averageDuration: number;
    slowestOperations: OperationTiming[];
    operationsByPhase: Map<string, OperationTiming[]>;
}

export class PerformanceTraceManager extends TraceManager {
    private operations: Map<number, OperationTiming> = new Map();
    private completedOperations: OperationTiming[] = [];

    constructor() {
        super();
    }

    emit(trace: Trace, message: string, details?: object): void {
        const operationKey = trace.id;
        
        if (message === TraceConstant.Entry) {
            // Start timing a new operation
            const operation: OperationTiming = {
                name: `${trace.phase}.${trace.task}`,
                phase: trace.phase,
                task: trace.task,
                id: trace.id,
                correlationId: trace.correlationId,
                startTime: trace.timeCreated,
                details,
            };
            this.operations.set(operationKey, operation);
        } else if (message === TraceConstant.Exit) {
            // Complete timing for existing operation
            const operation = this.operations.get(operationKey);
            if (operation) {
                const currentTime = performance.now();
                operation.endTime = currentTime;
                operation.duration = currentTime - operation.startTime;
                
                this.completedOperations.push(operation);
                this.operations.delete(operationKey);
            }
        }
        // Ignore intermediate trace messages for performance measurement
    }

    getSlowOperations(thresholdMs: number = 1): OperationTiming[] {
        return this.completedOperations
            .filter(op => (op.duration || 0) >= thresholdMs)
            .sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }

    getAllOperations(): OperationTiming[] {
        return [...this.completedOperations].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }

    getTimingReport(): TimingReport {
        const operations = this.completedOperations;
        const totalDuration = operations.reduce((sum, op) => sum + (op.duration || 0), 0);
        
        const operationsByPhase = new Map<string, OperationTiming[]>();
        operations.forEach(op => {
            if (!operationsByPhase.has(op.phase)) {
                operationsByPhase.set(op.phase, []);
            }
            operationsByPhase.get(op.phase)!.push(op);
        });

        return {
            totalOperations: operations.length,
            totalDuration,
            averageDuration: operations.length > 0 ? totalDuration / operations.length : 0,
            slowestOperations: this.getSlowOperations(1),
            operationsByPhase,
        };
    }

    clear(): void {
        this.operations.clear();
        this.completedOperations = [];
    }

    // Get operations by specific phase (e.g., "Inspection")
    getOperationsByPhase(phase: string): OperationTiming[] {
        return this.completedOperations.filter(op => op.phase === phase);
    }

    // Get scope inspection operations specifically
    getScopeInspectionOperations(): OperationTiming[] {
        return this.completedOperations.filter(op => 
            op.phase === "Inspection" && op.task.includes("Scope")
        );
    }
}
```

#### Usage in Performance Testing

```typescript
// Create performance tracer for detailed scope operation timing
const performanceTracer = new PerformanceTraceManager();

const analysisSettings: AnalysisSettings = {
    ...TestConstants.StandardLibraryAnalysisSettings,
    inspectionSettings: {
        ...TestConstants.StandardLibraryInspectionSettings,
        traceManager: performanceTracer, // Use performance tracer
        typeStrategy: TypeStrategy.Extended,
    },
};

// After validation, get detailed performance report
const report = performanceTracer.getTimingReport();
const slowOps = performanceTracer.getSlowOperations(10); // Operations >10ms
const scopeOps = performanceTracer.getScopeInspectionOperations();
```

#### Key Features of PerformanceTraceManager

- **Automatic trace capture**: Implements `TraceManager.emit()` to capture all scope operations
- **Detailed timing reports**: `getTimingReport()` provides operation-by-operation breakdown
- **Slow operation detection**: `getSlowOperations(threshold)` identifies bottlenecks
- **Operation grouping**: Groups timing data by operation type (e.g., "Inspection.Scope")
- **Memory management**: Properly cleans up completed operations
- **Scope-specific analysis**: `getScopeInspectionOperations()` isolates scope inspection bottlenecks

#### Critical for Baseline Testing

- Capture baseline performance before optimizations
- Monitor `Inspection.Scope` operations specifically (the main bottleneck)  
- Track cache hit rates and recursive call patterns
- Generate detailed reports for optimization validation
- **MUST CREATE THIS FILE FIRST** before running any performance tests

### Regression Detection

- Compare diagnostic counts before/after optimization
- Validate diagnostic message content unchanged
- Ensure unknown identifier detection still works
- Verify function signature validation preserved

## ⚠️ Current Test Infrastructure Issues

### Files with Broken Imports (Need Immediate Fix)

The following test files are currently **BROKEN** due to missing `PerformanceTraceManager`:

1. **`src/test/scope-optimization-baseline.test.ts`**
   - **Issue**: `import { PerformanceTraceManager } from "./performanceTraceManager";`
   - **Purpose**: Main baseline performance testing with comprehensive validation
   - **Fix Required**: Create `PerformanceTraceManager` class first

2. **`src/test/validation/scope-inspection-analysis.test.ts`**
   - **Issue**: `import { PerformanceTraceManager } from "../performanceTraceManager";`
   - **Purpose**: Deep dive analysis of scope inspection bottlenecks
   - **Fix Required**: Create `PerformanceTraceManager` class first

### Working Test Infrastructure ✅

The following test infrastructure is **WORKING** and available:

- **`TestUtils.assertValidateDiagnostics()`** - ✅ **EXISTS** in `src/test/testUtils/validationTestUtils.ts`
- **`TestUtils.assertValidate()`**
- **`TestConstants.StandardLibraryAnalysisSettings`** - ✅ **EXISTS** and properly configured
- **`TestConstants.StandardLibraryValidateAllSettings`** - ✅ **EXISTS** and includes StandardLibrary

The TestUtils.assertValidate* functions should be found in `src/test/testUtils/validationTestUtils.ts`.
If they do not exist, they should be added:

```typescript
export async function assertValidate(params: {
    readonly text: string;
    readonly analysisSettings: PQLS.AnalysisSettings;
    readonly validationSettings: PQLS.ValidationSettings;
}): Promise<PQLS.ValidateOk> {
    const mockDocument: MockDocument = TestUtils.mockDocument(params.text);

    const triedValidation: Result<PQLS.ValidateOk | undefined, CommonError.CommonError> = await PQLS.validate(
        mockDocument,
        params.analysisSettings,
        params.validationSettings,
    );

    ResultUtils.assertIsOk(triedValidation);
    Assert.isDefined(triedValidation.value);

    return triedValidation.value;
}

export async function assertValidateDiagnostics(params: {
    readonly text: string;
    readonly analysisSettings: PQLS.AnalysisSettings;
    readonly validationSettings: PQLS.ValidationSettings;
}): Promise<PQLS.Diagnostic[]> {
    return (await assertValidate(params)).diagnostics;
}
```

### Additional Test Utilities in Git Stash

The git stash contains additional validation test utilities that can be restored if needed:
- Enhanced error handling and cancellation testing utilities
- Non-deterministic timing test helpers  
- Performance measurement helpers

### Test Execution Order

1. **FIRST**: Create `src/test/performanceTraceManager.ts` with complete implementation above
2. **SECOND**: Run `npm test` to verify existing tests pass
3. **THIRD**: Execute baseline performance tests to establish benchmarks
4. **FOURTH**: Begin Phase 2/3 optimization work with proper regression detection

---

**Next Steps**: Create baseline benchmark tests, run against Kusto.pq, capture diagnostic baselines, then begin Phase 2 implementation with memoization and early returns.
