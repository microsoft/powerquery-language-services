// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../src/language";
import { OrderedMap } from "../../../../src/common";
import { TPowerQueryType } from "../../../../src/language/type/type";

describe(`TypeUtils.isEqualType`, () => {
    const closedStructures: ReadonlyArray<Type.DefinedRecord | Type.DefinedTable> = [
        TypeUtils.definedRecord(false, new Map([["a", Type.NumberInstance]]), false),
        TypeUtils.definedTable(false, new OrderedMap([["a", Type.NumberInstance]])),
    ];

    for (const closed of closedStructures) {
        it(`preserves open and closed ${closed.kind} alternatives in a union`, () => {
            const open: Type.DefinedRecord | Type.DefinedTable = { ...closed, isOpen: true };

            expect(TypeUtils.isEqualType(closed, open)).to.equal(false);
            expect(TypeUtils.isEqualType(open, closed)).to.equal(false);

            expect(TypeUtils.anyUnion([closed, open], NoOpTraceManagerInstance, undefined)).to.deep.equal({
                kind: Type.TypeKind.Any,
                extendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: false,
                unionedTypePairs: [closed, open],
            });
        });
    }

    function runTest(params: {
        readonly left: TPowerQueryType;
        readonly right: TPowerQueryType;
        readonly expected: boolean;
    }): void {
        const actual: boolean = TypeUtils.isEqualType(params.left, params.right);
        expect(actual).to.equal(params.expected);
    }

    describe(`${Type.ExtendedTypeKind.DefinedTable}`, () => {
        const fields: Type.OrderedFields = new OrderedMap([["Value", Type.NumberInstance]]);

        function row(value: number): Type.UnorderedFields {
            return new Map<string, Type.TPowerQueryType>([["Value", TypeUtils.numberLiteral(false, value)]]);
        }

        it(`equal rows`, () => {
            runTest({
                left: TypeUtils.definedTable(false, fields, [row(1), row(2)]),
                right: TypeUtils.definedTable(false, fields, [row(1), row(2)]),
                expected: true,
            });
        });

        it(`different row order`, () => {
            runTest({
                left: TypeUtils.definedTable(false, fields, [row(1), row(2)]),
                right: TypeUtils.definedTable(false, fields, [row(2), row(1)]),
                expected: false,
            });
        });

        it(`different row values`, () => {
            runTest({
                left: TypeUtils.definedTable(false, fields, [row(1)]),
                right: TypeUtils.definedTable(false, fields, [row(2)]),
                expected: false,
            });
        });

        it(`empty rows differ from non-empty rows`, () => {
            runTest({
                left: TypeUtils.definedTable(false, fields, []),
                right: TypeUtils.definedTable(false, fields, [row(1)]),
                expected: false,
            });
        });

        it(`unknown rows equal unknown rows`, () => {
            runTest({
                left: TypeUtils.definedTable(false, fields),
                right: TypeUtils.definedTable(false, fields),
                expected: true,
            });
        });

        it(`unknown rows differ from exact empty rows`, () => {
            runTest({
                left: TypeUtils.definedTable(false, fields),
                right: TypeUtils.definedTable(false, fields, []),
                expected: false,
            });
        });
    });
});
