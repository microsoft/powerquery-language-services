// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../src/language";
import { ArrayUtils } from "../../../../src/common";
import { NoOpTraceManagerInstance } from "../../../../src/common/trace";
import { OrderedMap } from "../../../../src";

interface AbridgedType {
    readonly kind: Type.TypeKind;
    readonly extendedKind: Type.ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

function abridgedPrimitiveType(kind: Type.TypeKind, isNullable: boolean): AbridgedType {
    return {
        kind,
        extendedKind: undefined,
        isNullable,
    };
}

function typeToAbridged(type: Type.TPowerQueryType): AbridgedType {
    return {
        kind: type.kind,
        extendedKind: type.extendedKind,
        isNullable: type.isNullable,
    };
}

function createAbridgedTypes(types: ReadonlyArray<Type.TPowerQueryType>): ReadonlyArray<AbridgedType> {
    return types.map(typeToAbridged);
}

const noopCreateAnyUnion: (types: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType = (
    types: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.anyUnion(types, NoOpTraceManagerInstance, undefined);

const noopNameOf: (type: Type.TPowerQueryType) => string = (type: Type.TPowerQueryType) =>
    TypeUtils.nameOf(type, NoOpTraceManagerInstance, undefined);

const noopSimplify: (types: ReadonlyArray<Type.TPowerQueryType>) => ReadonlyArray<Type.TPowerQueryType> = (
    types: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.simplify(types, NoOpTraceManagerInstance, undefined);

describe(`TypeUtils`, () => {
    describe(`simplify`, () => {
        it(`generic, identical nullability should reduce to single type`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.RecordInstance, Type.RecordInstance]),
            );

            const expected: ReadonlyArray<AbridgedType> = [abridgedPrimitiveType(Type.TypeKind.Record, false)];

            expect(actual.length).to.equal(1);
            expect(actual).deep.equal(expected);
        });

        it(`generic, mixed nullability should reduce to nullable`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.RecordInstance, Type.NullableRecordInstance]),
            );

            const expected: ReadonlyArray<AbridgedType> = [abridgedPrimitiveType(Type.TypeKind.Record, true)];

            expect(actual.length).to.equal(1);
            expect(actual).deep.equal(expected);
        });

        it(`early return with Any primitive`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.AnyInstance, Type.NullableRecordInstance]),
            );

            const expected: ReadonlyArray<AbridgedType> = [Type.AnyInstance];
            expect(actual).deep.equal(expected);
        });

        it(`simplify literal and primitive to primitive`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.NumberInstance, TypeUtils.numberLiteral(false, 1)]),
            );

            const expected: ReadonlyArray<AbridgedType> = [Type.NumberInstance];
            expect(actual).deep.equal(expected);
        });

        it(`retain multiple unique literals`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([
                TypeUtils.numberLiteral(false, 1),
                TypeUtils.numberLiteral(false, 2),
            ]);

            const expected: ReadonlyArray<AbridgedType> = [
                TypeUtils.numberLiteral(false, 1),
                TypeUtils.numberLiteral(false, 2),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`simplify true | false to boolean`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([Type.FalseInstance, Type.TrueInstance]);
            const expected: ReadonlyArray<AbridgedType> = [Type.LogicalInstance];
            expect(actual).deep.equal(expected);
        });

        for (const literal of [
            Type.TrueInstance,
            Type.FalseInstance,
            Type.NullableTrueInstance,
            Type.NullableFalseInstance,
        ]) {
            describe(`${literal.isNullable ? "nullable " : ""}${literal.normalizedLiteral}`, () => {
                it(`retain a single logical literal`, () => {
                    expect(noopSimplify([literal])).deep.equal([literal]);
                });

                it(`dedupe repeated logical literals`, () => {
                    expect(noopSimplify([literal, literal])).deep.equal([literal]);
                });

                it(`retain the logical alternative in a mixed-type union`, () => {
                    const number: Type.NumberLiteral = TypeUtils.numberLiteral(false, 1);

                    const expected: Type.AnyUnion = {
                        kind: Type.TypeKind.Any,
                        extendedKind: Type.ExtendedTypeKind.AnyUnion,
                        isNullable: literal.isNullable,
                        unionedTypePairs: [literal, number],
                    };

                    expect(noopCreateAnyUnion([literal, number])).deep.equal(expected);
                });

                it(`simplify with a logical primitive without losing nullability`, () => {
                    expect(noopSimplify([Type.LogicalInstance, literal])).deep.equal([
                        literal.isNullable ? Type.NullableLogicalInstance : Type.LogicalInstance,
                    ]);

                    expect(noopSimplify([literal, Type.NullableLogicalInstance])).deep.equal([
                        Type.NullableLogicalInstance,
                    ]);
                });
            });
        }

        for (const value of [true, false]) {
            it(`prefer nullable for mixed-nullability ${value} literals in either order`, () => {
                const literal: Type.LogicalLiteral = TypeUtils.logicalLiteral(false, value);
                const nullableLiteral: Type.LogicalLiteral = TypeUtils.logicalLiteral(true, value);

                expect(noopSimplify([literal, nullableLiteral, literal])).deep.equal([nullableLiteral]);
                expect(noopSimplify([nullableLiteral, literal, nullableLiteral])).deep.equal([nullableLiteral]);
            });
        }

        it(`retain a nullable logical primitive when both truth values are present`, () => {
            expect(noopSimplify([Type.NullableLogicalInstance, Type.TrueInstance, Type.FalseInstance])).deep.equal([
                Type.NullableLogicalInstance,
            ]);
        });

        it(`prefer nullable in boolean simplification`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([
                Type.FalseInstance,
                Type.TrueInstance,
                Type.NullableFalseInstance,
                Type.NullableTrueInstance,
            ]);

            const expected: ReadonlyArray<AbridgedType> = [Type.NullableLogicalInstance];
            expect(actual).deep.equal(expected);
        });

        it(`dedupe duplicate literals`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([
                TypeUtils.numberLiteral(false, 1),
                TypeUtils.numberLiteral(false, 1),
            ]);

            const expected: ReadonlyArray<AbridgedType> = [TypeUtils.numberLiteral(false, 1)];
            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single primitive type`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.RecordInstance, Type.RecordInstance]),
                noopCreateAnyUnion([Type.RecordInstance, Type.RecordInstance]),
            ]);

            expect(simplified.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(ArrayUtils.assertGet(simplified, 0));
            const expected: AbridgedType = TypeUtils.primitiveType(false, Type.TypeKind.Record);
            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, dedupe primitive types across AnyUnion`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.RecordInstance, Type.NullableTableInstance]),
                noopCreateAnyUnion([Type.RecordInstance, Type.NullableTableInstance]),
            ]);

            expect(simplified.length).to.equal(2);

            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(simplified);

            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, mixed nullability`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.NullableRecordInstance, Type.NullableTableInstance]),
                noopCreateAnyUnion([Type.RecordInstance, Type.TableInstance]),
            ]);

            expect(simplified.length).to.equal(4);

            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(simplified);

            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, true),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, false),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, dedupe across multi level AnyUnion`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([
                    Type.RecordInstance,
                    noopCreateAnyUnion([Type.RecordInstance, Type.NumberInstance]),
                ]),
                noopCreateAnyUnion([Type.RecordInstance]),
            ]);

            expect(simplified.length).to.equal(2);

            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(simplified);

            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Number, false),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, short circuit with Any primitive in AnyUnion`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.RecordInstance, noopCreateAnyUnion([Type.AnyInstance, Type.NumberInstance])]),
                noopCreateAnyUnion([Type.RecordInstance]),
            ]);

            expect(simplified.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(ArrayUtils.assertGet(simplified, 0));
            const expected: AbridgedType = typeToAbridged(Type.AnyInstance);
            expect(actual).deep.equal(expected);
        });
    });

    describe(`definedTable`, () => {
        const fields: Type.OrderedFields = new OrderedMap<string, Type.TPowerQueryType>([
            ["Name", Type.TextInstance],
            ["Value", Type.NumberInstance],
        ]);

        function row(entries: ReadonlyArray<[string, Type.TPowerQueryType]>): Type.UnorderedFields {
            return new Map<string, Type.TPowerQueryType>(entries);
        }

        it(`retains valid rows`, () => {
            const rows: ReadonlyArray<Type.UnorderedFields> = [
                row([
                    ["Name", TypeUtils.textLiteral(false, `"A"`)],
                    ["Value", TypeUtils.numberLiteral(false, 1)],
                ]),
            ];

            const type: Type.DefinedTable = TypeUtils.definedTable(false, fields, rows);

            expect(type.rows).to.equal(rows);
            expect(type.isOpen).to.equal(false);
        });

        it(`retains exact empty rows`, () => {
            const rows: ReadonlyArray<Type.UnorderedFields> = [];
            const type: Type.DefinedTable = TypeUtils.definedTable(false, fields, rows);

            expect(type.rows).to.equal(rows);
        });

        it(`allows unknown rows`, () => {
            const type: Type.DefinedTable = TypeUtils.definedTable(false, fields);

            expect(type.rows).to.be.undefined;
        });

        it(`accepts null for a nullable column`, () => {
            const nullableFields: Type.OrderedFields = new OrderedMap([["Value", Type.NullableNumberInstance]]);

            expect(() =>
                TypeUtils.definedTable(false, nullableFields, [row([["Value", Type.NullInstance]])]),
            ).not.to.throw();
        });

        it(`accepts a union-valued row field under the same union column`, () => {
            const union: Type.TPowerQueryType = noopCreateAnyUnion([Type.NumberInstance, Type.TextInstance]);
            const unionFields: Type.OrderedFields = new OrderedMap([["Value", union]]);

            expect(() => TypeUtils.definedTable(false, unionFields, [row([["Value", union]])])).not.to.throw();
        });

        it(`rejects a union-valued row field when only one alternative fits the column`, () => {
            const union: Type.TPowerQueryType = noopCreateAnyUnion([Type.NumberInstance, Type.TextInstance]);
            const numberFields: Type.OrderedFields = new OrderedMap([["Value", Type.NumberInstance]]);

            expect(() => TypeUtils.definedTable(false, numberFields, [row([["Value", union]])])).to.throw(
                `row field type is incompatible with table field type`,
            );
        });

        for (const columnType of [Type.DateInstance, Type.NullableDateInstance]) {
            it(`accepts a date row for a ${noopNameOf(columnType)} column`, () => {
                const dateFields: Type.OrderedFields = new OrderedMap([["D", columnType]]);
                const rows: ReadonlyArray<Type.UnorderedFields> = [row([["D", Type.DateInstance]])];

                expect(() => TypeUtils.definedTable(false, dateFields, rows)).not.to.throw();
            });
        }

        it(`rejects a row with a missing column`, () => {
            expect(() =>
                TypeUtils.definedTable(false, fields, [row([["Name", TypeUtils.textLiteral(false, `"A"`)]])]),
            ).to.throw(`row fields do not match table fields`);
        });

        it(`rejects a row with the wrong column name`, () => {
            expect(() =>
                TypeUtils.definedTable(false, fields, [
                    row([
                        ["Name", TypeUtils.textLiteral(false, `"A"`)],
                        ["Other", TypeUtils.numberLiteral(false, 1)],
                    ]),
                ]),
            ).to.throw(`row fields do not match table fields`);
        });

        it(`rejects an extra field`, () => {
            expect(() =>
                TypeUtils.definedTable(false, fields, [
                    row([
                        ["Name", TypeUtils.textLiteral(false, `"A"`)],
                        ["Value", TypeUtils.numberLiteral(false, 1)],
                        ["Extra", Type.AnyInstance],
                    ]),
                ]),
            ).to.throw(`row fields do not match table fields`);
        });

        it(`rejects an incompatible field type`, () => {
            expect(() =>
                TypeUtils.definedTable(false, fields, [
                    row([
                        ["Name", TypeUtils.textLiteral(false, `"A"`)],
                        ["Value", TypeUtils.textLiteral(false, `"B"`)],
                    ]),
                ]),
            ).to.throw(`row field type is incompatible with table field type`);
        });

        it(`rejects null for a non-nullable column`, () => {
            expect(() =>
                TypeUtils.definedTable(false, fields, [
                    row([
                        ["Name", TypeUtils.textLiteral(false, `"A"`)],
                        ["Value", Type.NullInstance],
                    ]),
                ]),
            ).to.throw(`row field type is incompatible with table field type`);
        });
    });
});
