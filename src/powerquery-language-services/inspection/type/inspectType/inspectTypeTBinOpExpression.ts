// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, CommonError } from "@microsoft/powerquery-parser";
import { Ast, AstUtils, Constant, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";

type TRecordOrTable = Type.TRecord | Type.TTable;

export async function inspectTypeTBinOpExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeTBinOpExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();

    Assert.isTrue(AstUtils.isTBinOpExpressionKind(xorNode.node.kind), `xorNode isn't a TBinOpExpression`, {
        nodeId: xorNode.node.id,
        nodeKind: xorNode.node.kind,
    });

    const parentId: number = xorNode.node.id;

    const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
        state.nodeIdMapCollection,
        parentId,
    );

    const left: TXorNode | undefined = children[0];

    const operatorKind: Constant.TBinOpExpressionOperator | undefined =
        children[1] === undefined || XorNodeUtils.isContextXor(children[1])
            ? undefined
            : (children[1].node as Ast.IConstant<Constant.TBinOpExpressionOperator>).constantKind;

    const right: TXorNode | undefined = children[2];

    let result: Type.TPowerQueryType;

    // ''
    if (left === undefined) {
        result = Type.UnknownInstance;
    }
    // '1'
    else if (operatorKind === undefined) {
        result = await inspectXor(state, left, trace.id);
    }
    // '1 +'
    else if (right === undefined || XorNodeUtils.isContextXor(right)) {
        const leftType: Type.TPowerQueryType = await inspectXor(state, left, trace.id);

        const key: string = partialLookupKey(leftType.kind, operatorKind);
        const allowedTypeKinds: ReadonlySet<Type.TypeKind> | undefined = PartialLookup.get(key);

        if (allowedTypeKinds === undefined) {
            result = Type.NoneInstance;
        } else if (allowedTypeKinds.size === 1) {
            result = TypeUtils.primitiveType(leftType.isNullable, allowedTypeKinds.values().next().value);
        } else {
            const unionedTypePairs: Type.TPowerQueryType[] = [];

            for (const kind of allowedTypeKinds.values()) {
                unionedTypePairs.push({
                    kind,
                    extendedKind: undefined,
                    isNullable: true,
                });
            }

            result = TypeUtils.anyUnion(unionedTypePairs, state.traceManager, trace.id);
        }
    }
    // '1 + 1'
    else {
        const leftType: Type.TPowerQueryType = await inspectXor(state, left, trace.id);
        const rightType: Type.TPowerQueryType = await inspectXor(state, right, trace.id);

        const key: string = lookupKey(leftType.kind, operatorKind, rightType.kind);
        const resultTypeKind: Type.TypeKind | undefined = Lookup.get(key);

        if (resultTypeKind === undefined) {
            result = Type.NoneInstance;
        } else if (
            operatorKind === Constant.ArithmeticOperator.And &&
            (resultTypeKind === Type.TypeKind.Record || resultTypeKind === Type.TypeKind.Table)
        ) {
            result = inspectRecordOrTableUnion(leftType as TRecordOrTable, rightType as TRecordOrTable);
        } else {
            result = TypeUtils.primitiveType(leftType.isNullable || rightType.isNullable, resultTypeKind);
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function inspectRecordOrTableUnion(leftType: TRecordOrTable, rightType: TRecordOrTable): Type.TPowerQueryType {
    if (leftType.kind !== rightType.kind) {
        const details: object = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };

        throw new PQP.CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []' or '#table() & #table()'
    else if (leftType.extendedKind === undefined && rightType.extendedKind === undefined) {
        return TypeUtils.primitiveType(leftType.isNullable || rightType.isNullable, leftType.kind);
    }
    // '[key=value] & []' or '#table(...) & #table()`
    // '[] & [key=value]' or `#table() & #table(...)`
    else if (
        (leftType.extendedKind !== undefined && rightType.extendedKind === undefined) ||
        (leftType.extendedKind === undefined && rightType.extendedKind !== undefined)
    ) {
        // The 'rightType as (...)' isn't needed, except TypeScript's checker isn't smart enough to know it.
        const extendedKind: Type.DefinedRecord | Type.DefinedTable =
            leftType.extendedKind !== undefined ? leftType : (rightType as Type.DefinedRecord | Type.DefinedTable);

        return {
            ...extendedKind,
            isOpen: true,
        };
    }
    // '[foo=value] & [bar=value] or #table(...) & #table(...)'
    else if (leftType?.extendedKind === rightType?.extendedKind) {
        // The cast should be safe since the first if statement tests their the same kind,
        // and the above checks if they're the same extended kind.

        if (TypeUtils.isRecord(leftType)) {
            return unionRecordFields([leftType, rightType] as [Type.DefinedRecord, Type.DefinedRecord]);
        } else {
            return unionTableFields([leftType, rightType] as [Type.DefinedTable, Type.DefinedTable]);
        }
    } else {
        throw new CommonError.InvariantError(`this should never be reached`);
    }
}

function unionRecordFields([leftType, rightType]: [Type.DefinedRecord, Type.DefinedRecord]): Type.DefinedRecord {
    const combinedFields: Map<string, Type.TPowerQueryType> = new Map(leftType.fields);

    for (const [key, value] of rightType.fields.entries()) {
        combinedFields.set(key, value);
    }

    return {
        ...leftType,
        fields: combinedFields,
        isNullable: leftType.isNullable && rightType.isNullable,
        isOpen: leftType.isOpen || rightType.isOpen,
    };
}

function unionTableFields([leftType, rightType]: [Type.DefinedTable, Type.DefinedTable]): Type.DefinedTable {
    const combinedFields: Type.OrderedFields = new PQP.OrderedMap([...leftType.fields]);

    for (const [key, value] of rightType.fields.entries()) {
        combinedFields.set(key, value);
    }

    return {
        ...leftType,
        fields: combinedFields,
        isNullable: leftType.isNullable && rightType.isNullable,
        isOpen: leftType.isOpen || rightType.isOpen,
    };
}

// Keys: <first operand> <operator> <second operand>
// Values: the resulting type of the binary operation expression.
// Eg. '1 > 3' -> Type.TypeKind.Number
export const Lookup: ReadonlyMap<string, Type.TypeKind> = new Map([
    ...lookupsForNullEquality(),

    ...lookupsForRelational(Type.TypeKind.Null),
    ...lookupsForEquality(Type.TypeKind.Null),

    ...lookupsForRelational(Type.TypeKind.Logical),
    ...lookupsForEquality(Type.TypeKind.Logical),
    ...lookupsForLogical(Type.TypeKind.Logical),

    ...lookupsForRelational(Type.TypeKind.Number),
    ...lookupsForEquality(Type.TypeKind.Number),
    ...lookupsForArithmetic(Type.TypeKind.Number),

    ...lookupsForRelational(Type.TypeKind.Time),
    ...lookupsForEquality(Type.TypeKind.Time),
    ...lookupsForClockKind(Type.TypeKind.Time),
    [lookupKey(Type.TypeKind.Date, Constant.ArithmeticOperator.And, Type.TypeKind.Time), Type.TypeKind.DateTime],

    ...lookupsForRelational(Type.TypeKind.Date),
    ...lookupsForEquality(Type.TypeKind.Date),
    ...lookupsForClockKind(Type.TypeKind.Date),
    [lookupKey(Type.TypeKind.Date, Constant.ArithmeticOperator.And, Type.TypeKind.Time), Type.TypeKind.DateTime],

    ...lookupsForRelational(Type.TypeKind.DateTime),
    ...lookupsForEquality(Type.TypeKind.DateTime),
    ...lookupsForClockKind(Type.TypeKind.DateTime),

    ...lookupsForRelational(Type.TypeKind.DateTimeZone),
    ...lookupsForEquality(Type.TypeKind.DateTimeZone),
    ...lookupsForClockKind(Type.TypeKind.DateTimeZone),

    ...lookupsForRelational(Type.TypeKind.Duration),
    ...lookupsForEquality(Type.TypeKind.Duration),
    [
        lookupKey(Type.TypeKind.Duration, Constant.ArithmeticOperator.Addition, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Duration, Constant.ArithmeticOperator.Subtraction, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Duration, Constant.ArithmeticOperator.Multiplication, Type.TypeKind.Number),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Number, Constant.ArithmeticOperator.Multiplication, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Duration, Constant.ArithmeticOperator.Division, Type.TypeKind.Number),
        Type.TypeKind.Duration,
    ],

    ...lookupsForRelational(Type.TypeKind.Text),
    ...lookupsForEquality(Type.TypeKind.Text),
    [lookupKey(Type.TypeKind.Text, Constant.ArithmeticOperator.And, Type.TypeKind.Text), Type.TypeKind.Text],

    ...lookupsForRelational(Type.TypeKind.Binary),
    ...lookupsForEquality(Type.TypeKind.Binary),

    ...lookupsForEquality(Type.TypeKind.List),
    [lookupKey(Type.TypeKind.List, Constant.ArithmeticOperator.And, Type.TypeKind.List), Type.TypeKind.List],

    ...lookupsForEquality(Type.TypeKind.Record),
    [lookupKey(Type.TypeKind.Record, Constant.ArithmeticOperator.And, Type.TypeKind.Record), Type.TypeKind.Record],

    ...lookupsForEquality(Type.TypeKind.Table),
    [lookupKey(Type.TypeKind.Table, Constant.ArithmeticOperator.And, Type.TypeKind.Table), Type.TypeKind.Table],
]);

// Keys: <first operand> <operator>
// Values: a set of types that are allowed for <second operand>
// Eg. '1 + ' ->
export const PartialLookup: ReadonlyMap<string, ReadonlySet<Type.TypeKind>> = new Map(
    // Grab the keys
    [...Lookup.keys()]
        .reduce(
            (
                binaryExpressionPartialLookup: Map<string, Set<Type.TypeKind>>,
                key: string,
                _currentIndex: number,
                _array: ReadonlyArray<string>,
            ): Map<string, Set<Type.TypeKind>> => {
                const lastDeliminatorIndex: number = key.lastIndexOf(",");
                // Grab '<first operand> , <operator>'.
                const partialKey: string = key.slice(0, lastDeliminatorIndex);
                // Grab '<second operand>'.
                const potentialNewValue: Type.TypeKind = key.slice(lastDeliminatorIndex + 1) as Type.TypeKind;

                // Add the potentialNewValue if it's a new Type.
                const values: Set<Type.TypeKind> | undefined = binaryExpressionPartialLookup.get(partialKey);

                // First occurance of '<first operand> , <operator>'
                if (values === undefined) {
                    binaryExpressionPartialLookup.set(partialKey, new Set([potentialNewValue]));
                } else {
                    values.add(potentialNewValue);
                }

                return binaryExpressionPartialLookup;
            },
            new Map(),
        )
        .entries(),
);

export function lookupKey(
    leftTypeKind: Type.TypeKind,
    operatorKind: Constant.TBinOpExpressionOperator,
    rightTypeKind: Type.TypeKind,
): string {
    return `${leftTypeKind},${operatorKind},${rightTypeKind}`;
}

export function partialLookupKey(leftTypeKind: Type.TypeKind, operatorKind: Constant.TBinOpExpressionOperator): string {
    return `${leftTypeKind},${operatorKind}`;
}

function lookupsForRelational(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.RelationalOperator.GreaterThan, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.RelationalOperator.GreaterThanEqualTo, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.RelationalOperator.LessThan, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.RelationalOperator.LessThanEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

function lookupsForEquality(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.EqualityOperator.EqualTo, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.EqualityOperator.NotEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

function lookupsForNullEquality(): ReadonlyArray<[string, Type.TypeKind]> {
    const results: [string, Type.TypeKind][] = [];

    for (const typeKind of Type.TypeKinds) {
        results.push([
            lookupKey(typeKind, Constant.EqualityOperator.EqualTo, Type.TypeKind.Null),
            Type.TypeKind.Logical,
        ]);

        results.push([
            lookupKey(typeKind, Constant.EqualityOperator.NotEqualTo, Type.TypeKind.Null),
            Type.TypeKind.Logical,
        ]);

        results.push([
            lookupKey(Type.TypeKind.Null, Constant.EqualityOperator.EqualTo, typeKind),
            Type.TypeKind.Logical,
        ]);

        results.push([
            lookupKey(Type.TypeKind.Null, Constant.EqualityOperator.NotEqualTo, typeKind),
            Type.TypeKind.Logical,
        ]);
    }

    return results;
}

// Note: does not include the and <'&'> Constant.
function lookupsForArithmetic(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.ArithmeticOperator.Addition, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Division, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Multiplication, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Subtraction, typeKind), typeKind],
    ];
}

function lookupsForLogical(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.LogicalOperator.And, typeKind), typeKind],
        [lookupKey(typeKind, Constant.LogicalOperator.Or, typeKind), typeKind],
    ];
}

function lookupsForClockKind(
    typeKind: Type.TypeKind.Date | Type.TypeKind.DateTime | Type.TypeKind.DateTimeZone | Type.TypeKind.Time,
): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.ArithmeticOperator.Addition, Type.TypeKind.Duration), typeKind],
        [lookupKey(Type.TypeKind.Duration, Constant.ArithmeticOperator.Addition, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Subtraction, Type.TypeKind.Duration), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Subtraction, typeKind), Type.TypeKind.Duration],
    ];
}
