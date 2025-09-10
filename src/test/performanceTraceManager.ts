// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Trace, TraceConstant, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

export interface OperationTiming {
    readonly name: string;
    readonly phase: string;
    readonly task: string;
    readonly id: number;
    readonly correlationId?: number;
    readonly startTime: number;
    readonly endTime?: number;
    readonly duration?: number;
    readonly details?: any;
}

export interface TimingReport {
    readonly totalOperations: number;
    readonly totalDuration: number;
    readonly averageDuration: number;
    readonly slowestOperations: ReadonlyArray<OperationTiming>;
    readonly operationsByPhase: ReadonlyMap<string, ReadonlyArray<OperationTiming>>;
}

export class PerformanceTraceManager extends TraceManager {
    private readonly operations: Map<number, OperationTiming> = new Map();
    private readonly completedOperations: OperationTiming[] = [];

    public constructor() {
        super();
    }

    public emit(trace: Trace, message: string, details?: object): void {
        const operationKey: number = trace.id;

        if (message === TraceConstant.Entry) {
            // Start timing a new operation
            const operation: OperationTiming = {
                name: `${trace.phase}.${trace.task}`,
                phase: trace.phase,
                task: trace.task,
                id: trace.id,
                correlationId: trace.correlationId,
                startTime: Date.now(),
                details,
            };

            this.operations.set(operationKey, operation);
        } else if (message === TraceConstant.Exit) {
            // Complete timing for existing operation
            const operation: OperationTiming | undefined = this.operations.get(operationKey);

            if (operation) {
                const currentTime: number = Date.now();

                const completedOperation: OperationTiming = {
                    ...operation,
                    endTime: currentTime,
                    duration: currentTime - operation.startTime,
                };

                this.completedOperations.push(completedOperation);
                this.operations.delete(operationKey);
            }
        }
        // Ignore intermediate trace messages for performance measurement
    }

    public getSlowOperations(thresholdMs: number = 1): ReadonlyArray<OperationTiming> {
        return this.completedOperations
            .filter((op: OperationTiming) => (op.duration || 0) >= thresholdMs)
            .sort((a: OperationTiming, b: OperationTiming) => (b.duration || 0) - (a.duration || 0));
    }

    public getAllOperations(): ReadonlyArray<OperationTiming> {
        return [...this.completedOperations].sort(
            (a: OperationTiming, b: OperationTiming) => (b.duration || 0) - (a.duration || 0),
        );
    }

    public getTimingReport(): TimingReport {
        const operations: OperationTiming[] = this.completedOperations;

        const totalDuration: number = operations.reduce(
            (sum: number, op: OperationTiming) => sum + (op.duration || 0),
            0,
        );

        const operationsByPhase: Map<string, OperationTiming[]> = new Map();

        operations.forEach((op: OperationTiming) => {
            if (!operationsByPhase.has(op.phase)) {
                operationsByPhase.set(op.phase, []);
            }

            operationsByPhase.get(op.phase)!.push(op);
        });

        const readonlyOperationsByPhase: Map<string, ReadonlyArray<OperationTiming>> = new Map();

        operationsByPhase.forEach((ops: OperationTiming[], phase: string) => {
            readonlyOperationsByPhase.set(phase, ops);
        });

        return {
            totalOperations: operations.length,
            totalDuration,
            averageDuration: operations.length > 0 ? totalDuration / operations.length : 0,
            slowestOperations: this.getSlowOperations(1),
            operationsByPhase: readonlyOperationsByPhase,
        };
    }

    public clear(): void {
        this.operations.clear();
        this.completedOperations.length = 0;
    }

    public getOperationsByPhase(phase: string): ReadonlyArray<OperationTiming> {
        return this.completedOperations.filter((op: OperationTiming) => op.phase === phase);
    }

    public getScopeInspectionOperations(): ReadonlyArray<OperationTiming> {
        return this.completedOperations.filter((op: OperationTiming) => op.name.startsWith("Inspection.Scope"));
    }

    public getInspectionOperations(): ReadonlyArray<OperationTiming> {
        return this.completedOperations.filter((op: OperationTiming) => op.phase === "Inspection");
    }

    public getScopeInspectionSummary(): { totalOperations: number; totalTime: number; avgTime: number } {
        const scopeOps: ReadonlyArray<OperationTiming> = this.getScopeInspectionOperations();
        const totalTime: number = scopeOps.reduce((sum: number, op: OperationTiming) => sum + (op.duration || 0), 0);

        return {
            totalOperations: scopeOps.length,
            totalTime,
            avgTime: scopeOps.length > 0 ? totalTime / scopeOps.length : 0,
        };
    }
}
