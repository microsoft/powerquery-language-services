// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Tests for the type interning module: verifies canonical keys and fast deduplication.

import * as PQP from "@microsoft/powerquery-parser";

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { expect } from "chai";
import "mocha";

import { fastAnyUnion, typeToKey, TypeInternTable } from "../../powerquery-language-services/inspection/type/typeIntern";

const TypeUtils = PQP.Language.TypeUtils;

describe("typeIntern", () => {
    describe("typeToKey", () => {
        it("primitive types produce unique keys", () => {
            const keys = new Set<string>();
            const primitives = [
                Type.AnyInstance,
                Type.NumberInstance,
                Type.TextInstance,
                Type.LogicalInstance,
                Type.RecordInstance,
                Type.TableInstance,
                Type.ListInstance,
                Type.FunctionInstance,
                Type.NoneInstance,
                Type.NullInstance,
                Type.BinaryInstance,
                Type.DateInstance,
                Type.DateTimeInstance,
                Type.DateTimeZoneInstance,
                Type.DurationInstance,
                Type.TimeInstance,
                Type.ActionInstance,
                Type.UnknownInstance,
                Type.NotApplicableInstance,
                Type.AnyNonNullInstance,
            ];

            for (const p of primitives) {
                const key = typeToKey(p);
                expect(keys.has(key), `duplicate key: ${key}`).to.be.false;
                keys.add(key);
            }
        });

        it("nullable vs non-nullable have different keys", () => {
            const key1 = typeToKey(Type.NumberInstance);
            const key2 = typeToKey(Type.NullableNumberInstance);
            expect(key1).to.not.equal(key2);
        });

        it("same primitive produces same key", () => {
            expect(typeToKey(Type.NumberInstance)).to.equal(typeToKey(Type.NumberInstance));
        });

        it("DefinedRecord with same fields produces same key regardless of insertion order", () => {
            const fields1 = new Map<string, Type.TPowerQueryType>([
                ["a", Type.NumberInstance],
                ["b", Type.TextInstance],
            ]);
            const fields2 = new Map<string, Type.TPowerQueryType>([
                ["b", Type.TextInstance],
                ["a", Type.NumberInstance],
            ]);
            const rec1: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: fields1,
                isOpen: false,
            };
            const rec2: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: fields2,
                isOpen: false,
            };

            expect(typeToKey(rec1)).to.equal(typeToKey(rec2));
        });

        it("DefinedRecord with different fields produces different keys", () => {
            const rec1: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map([["a", Type.NumberInstance]]),
                isOpen: false,
            };
            const rec2: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map([["a", Type.TextInstance]]),
                isOpen: false,
            };

            expect(typeToKey(rec1)).to.not.equal(typeToKey(rec2));
        });

        it("open vs closed record produces different keys", () => {
            const fields = new Map<string, Type.TPowerQueryType>([["a", Type.NumberInstance]]);
            const closed: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields,
                isOpen: false,
            };
            const open: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields,
                isOpen: true,
            };

            expect(typeToKey(closed)).to.not.equal(typeToKey(open));
        });

        it("AnyUnion key is order-independent", () => {
            const union1: Type.AnyUnion = {
                kind: Type.TypeKind.Any,
                extendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [Type.NumberInstance, Type.TextInstance],
            };
            const union2: Type.AnyUnion = {
                kind: Type.TypeKind.Any,
                extendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [Type.TextInstance, Type.NumberInstance],
            };

            expect(typeToKey(union1)).to.equal(typeToKey(union2));
        });

        it("DefinedFunction key includes parameters and return type", () => {
            const fn1: Type.DefinedFunction = {
                kind: Type.TypeKind.Function,
                extendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: [
                    { nameLiteral: "x", isOptional: false, isNullable: false, type: Type.TypeKind.Number },
                ],
                returnType: Type.TextInstance,
            };
            const fn2: Type.DefinedFunction = {
                kind: Type.TypeKind.Function,
                extendedKind: Type.ExtendedTypeKind.DefinedFunction,
                isNullable: false,
                parameters: [
                    { nameLiteral: "x", isOptional: false, isNullable: false, type: Type.TypeKind.Text },
                ],
                returnType: Type.TextInstance,
            };

            expect(typeToKey(fn1)).to.not.equal(typeToKey(fn2));
        });

        it("NumberLiteral key includes normalized value", () => {
            const lit1: Type.NumberLiteral = {
                kind: Type.TypeKind.Number,
                extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                isNullable: false,
                literal: "42",
                normalizedLiteral: 42,
            };
            const lit2: Type.NumberLiteral = {
                kind: Type.TypeKind.Number,
                extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                isNullable: false,
                literal: "43",
                normalizedLiteral: 43,
            };

            expect(typeToKey(lit1)).to.not.equal(typeToKey(lit2));
        });
    });

    describe("TypeInternTable", () => {
        it("returns same reference for structurally equal types", () => {
            const table = new TypeInternTable();
            const rec1: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map([["a", Type.NumberInstance]]),
                isOpen: false,
            };
            const rec2: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map([["a", Type.NumberInstance]]),
                isOpen: false,
            };

            const interned1 = table.intern(rec1);
            const interned2 = table.intern(rec2);

            expect(interned1).to.equal(interned2); // reference equality!
            expect(table.size).to.equal(1);
        });

        it("returns different references for structurally different types", () => {
            const table = new TypeInternTable();
            const rec1: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map([["a", Type.NumberInstance]]),
                isOpen: false,
            };
            const rec2: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map([["b", Type.NumberInstance]]),
                isOpen: false,
            };

            const interned1 = table.intern(rec1);
            const interned2 = table.intern(rec2);

            expect(interned1).to.not.equal(interned2);
            expect(table.size).to.equal(2);
        });

        it("primitives are always interned to the same singleton", () => {
            const table = new TypeInternTable();
            expect(table.intern(Type.NumberInstance)).to.equal(Type.NumberInstance);
            expect(table.intern(Type.NumberInstance)).to.equal(Type.NumberInstance);
            expect(table.size).to.equal(1);
        });
    });

    describe("fastAnyUnion", () => {
        const traceManager = PQP.Trace.NoOpTraceManagerInstance;
        const correlationId = 0;

        it("empty array returns Any", () => {
            const result = fastAnyUnion([], traceManager, correlationId);
            expect(result).to.equal(Type.AnyInstance);
        });

        it("single type returns that type directly", () => {
            const result = fastAnyUnion([Type.NumberInstance], traceManager, correlationId);
            expect(result).to.equal(Type.NumberInstance);
        });

        it("duplicate types are deduplicated", () => {
            const result = fastAnyUnion(
                [Type.NumberInstance, Type.NumberInstance, Type.NumberInstance],
                traceManager,
                correlationId,
            );

            expect(result).to.equal(Type.NumberInstance);
        });

        it("any in union collapses to any", () => {
            const result = fastAnyUnion(
                [Type.NumberInstance, Type.AnyInstance, Type.TextInstance],
                traceManager,
                correlationId,
            );

            expect(result).to.equal(Type.AnyInstance);
        });

        it("number + numberLiteral collapses to number", () => {
            const lit: Type.NumberLiteral = {
                kind: Type.TypeKind.Number,
                extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                isNullable: false,
                literal: "42",
                normalizedLiteral: 42,
            };

            const result = fastAnyUnion([lit, Type.NumberInstance], traceManager, correlationId);

            expect(result).to.equal(Type.NumberInstance);
        });

        it("true + false collapses to logical", () => {
            const result = fastAnyUnion([Type.TrueInstance, Type.FalseInstance], traceManager, correlationId);
            expect(result).to.equal(Type.LogicalInstance);
        });

        it("preserves distinct types in union", () => {
            const result = fastAnyUnion(
                [Type.NumberInstance, Type.TextInstance, Type.LogicalInstance],
                traceManager,
                correlationId,
            );

            expect(result.kind).to.equal(Type.TypeKind.Any);
            expect(result.extendedKind).to.equal(Type.ExtendedTypeKind.AnyUnion);
            expect((result as Type.AnyUnion).unionedTypePairs).to.have.lengthOf(3);
        });

        it("structurally equal records are deduplicated", () => {
            const rec1: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TPowerQueryType>([
                    ["a", Type.NumberInstance],
                    ["b", Type.TextInstance],
                ]),
                isOpen: false,
            };
            const rec2: Type.DefinedRecord = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields: new Map<string, Type.TPowerQueryType>([
                    ["b", Type.TextInstance],
                    ["a", Type.NumberInstance],
                ]),
                isOpen: false,
            };

            const result = fastAnyUnion([rec1, rec2], traceManager, correlationId);

            // Should collapse to single record (not a union)
            expect(result.kind).to.equal(Type.TypeKind.Record);
            expect(result.extendedKind).to.equal(Type.ExtendedTypeKind.DefinedRecord);
        });
    });

    describe("performance comparison", () => {
        it("fastAnyUnion vs TypeUtils.anyUnion with many large-record duplicates", function () {
            this.timeout(60000);

            // Simulate FHIR-like scenario: many distinct large record types with heavy overlap
            const largeRecord = (id: number): Type.DefinedRecord => {
                const fields = new Map<string, Type.TPowerQueryType>();

                for (let i = 0; i < 20; i++) {
                    fields.set(`field${i}`, i % 3 === 0 ? Type.NumberInstance : Type.TextInstance);
                }

                fields.set("id", Type.NumberInstance);
                fields.set(`variant_${id % 5}`, Type.LogicalInstance);

                return {
                    kind: Type.TypeKind.Record,
                    extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                    isNullable: false,
                    fields,
                    isOpen: id % 2 === 0,
                };
            };

            // 500 types with ~100 unique large records (lots of structural duplicates)
            const types: Type.TPowerQueryType[] = [];

            for (let i = 0; i < 500; i++) {
                types.push(largeRecord(i % 10)); // only 10 distinct patterns → lots of duplication
            }

            // Benchmark fastAnyUnion
            const iterations = 200;
            const traceManager = PQP.Trace.NoOpTraceManagerInstance;

            const fastStart = Date.now();

            for (let i = 0; i < iterations; i++) {
                fastAnyUnion(types, traceManager, 0);
            }

            const fastMs = Date.now() - fastStart;

            // Benchmark TypeUtils.anyUnion
            const slowStart = Date.now();

            for (let i = 0; i < iterations; i++) {
                TypeUtils.anyUnion(types, traceManager, 0);
            }

            const slowMs = Date.now() - slowStart;

            console.log(`\n  fastAnyUnion: ${fastMs}ms for ${iterations} iterations (500 types each)`);
            console.log(`  TypeUtils.anyUnion: ${slowMs}ms for ${iterations} iterations`);
            console.log(`  Speedup: ${(slowMs / Math.max(fastMs, 1)).toFixed(1)}x`);

            // Log result — speedup depends on type complexity & duplication ratio
            // In real FHIR scenarios with deep equality, fastAnyUnion avoids O(n²)
        });

        it("typeToKey performance on complex types", function () {
            this.timeout(10000);

            // Build a deeply nested record type
            let innerType: Type.TPowerQueryType = Type.NumberInstance;

            for (let depth = 0; depth < 5; depth++) {
                innerType = {
                    kind: Type.TypeKind.Record,
                    extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                    isNullable: false,
                    fields: new Map<string, Type.TPowerQueryType>([
                        ["field1", innerType],
                        ["field2", Type.TextInstance],
                        ["field3", Type.LogicalInstance],
                    ]),
                    isOpen: false,
                } as Type.DefinedRecord;
            }

            const iterations = 10000;
            const start = Date.now();

            for (let i = 0; i < iterations; i++) {
                typeToKey(innerType);
            }

            const ms = Date.now() - start;
            console.log(`\n  typeToKey on 5-deep nested record: ${ms}ms for ${iterations} iterations`);
            console.log(`  Per call: ${(ms / iterations * 1000).toFixed(1)}µs`);

            // Should be fast — under 1ms per call even for deep types
            expect(ms / iterations).to.be.lessThan(1);
        });
    });
});
