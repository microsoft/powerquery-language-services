// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../src/language";
import { OrderedMap } from "../../../../src/common";
import { TPowerQueryType } from "../../../../src/language/type/type";

describe(`TypeUtils.isEqualType`, () => {
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
