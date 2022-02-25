// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, AstUtils, Constant, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

type TRecordOrTable = Type.TRecord | Type.TTable;

export async function inspectTypeTBinOpExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeTBinOpExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();

    Assert.isTrue(AstUtils.isTBinOpExpressionKind(xorNode.node.kind), `xorNode isn't a TBinOpExpression`, {
        nodeId: xorNode.node.id,
        nodeKind: xorNode.node.kind,
    });

    const parentId: number = xorNode.node.id;

    const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
        state.nodeIdMapCollection,
        parentId,
    );

    const maybeLeft: TXorNode | undefined = children[0];

    const maybeOperatorKind: Constant.TBinOpExpressionOperator | undefined =
        children[1] === undefined || XorNodeUtils.isContextXor(children[1])
            ? undefined
            : (children[1].node as Ast.IConstant<Constant.TBinOpExpressionOperator>).constantKind;

    const maybeRight: TXorNode | undefined = children[2];

    let result: Type.TPowerQueryType;

    // ''
    if (maybeLeft === undefined) {
        result = Type.UnknownInstance;
    }
    // '1'
    else if (maybeOperatorKind === undefined) {
        result = await inspectXor(state, maybeLeft);
    }
    // '1 +'
    else if (maybeRight === undefined || XorNodeUtils.isContextXor(maybeRight)) {
        const leftType: Type.TPowerQueryType = await inspectXor(state, maybeLeft);
        const operatorKind: Constant.TBinOpExpressionOperator = maybeOperatorKind;

        const key: string = partialLookupKey(leftType.kind, operatorKind);
        const maybeAllowedTypeKinds: ReadonlySet<Type.TypeKind> | undefined = PartialLookup.get(key);

        if (maybeAllowedTypeKinds === undefined) {
            result = Type.NoneInstance;
        } else if (maybeAllowedTypeKinds.size === 1) {
            result = TypeUtils.createPrimitiveType(leftType.isNullable, maybeAllowedTypeKinds.values().next().value);
        } else {
            const unionedTypePairs: Type.TPowerQueryType[] = [];

            for (const kind of maybeAllowedTypeKinds.values()) {
                unionedTypePairs.push({
                    kind,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                });
            }

            result = TypeUtils.createAnyUnion(unionedTypePairs);
        }
    }
    // '1 + 1'
    else {
        const leftType: Type.TPowerQueryType = await inspectXor(state, maybeLeft);
        const operatorKind: Constant.TBinOpExpressionOperator = maybeOperatorKind;
        const rightType: Type.TPowerQueryType = await inspectXor(state, maybeRight);

        const key: string = lookupKey(leftType.kind, operatorKind, rightType.kind);
        const maybeResultTypeKind: Type.TypeKind | undefined = Lookup.get(key);

        if (maybeResultTypeKind === undefined) {
            result = Type.NoneInstance;
        } else {
            const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

            // '[foo = 1] & [bar = 2]'
            if (
                operatorKind === Constant.ArithmeticOperator.And &&
                (resultTypeKind === Type.TypeKind.Record || resultTypeKind === Type.TypeKind.Table)
            ) {
                result = inspectRecordOrTableUnion(leftType as TRecordOrTable, rightType as TRecordOrTable);
            } else {
                result = TypeUtils.createPrimitiveType(leftType.isNullable || rightType.isNullable, resultTypeKind);
            }
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

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
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return TypeUtils.createPrimitiveType(leftType.isNullable || rightType.isNullable, leftType.kind);
    }
    // '[key=value] & []' or '#table(...) & #table()`
    // '[] & [key=value]' or `#table() & #table(...)`
    else if (
        (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind === undefined) ||
        (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind !== undefined)
    ) {
        // The 'rightType as (...)' isn't needed, except TypeScript's checker isn't smart enough to know it.
        const extendedType: Type.DefinedRecord | Type.DefinedTable =
            leftType.maybeExtendedKind !== undefined ? leftType : (rightType as Type.DefinedRecord | Type.DefinedTable);

        return {
            ...extendedType,
            isOpen: true,
        };
    }
    // '[foo=value] & [bar=value] or #table(...) & #table(...)'
    else if (leftType?.maybeExtendedKind === rightType?.maybeExtendedKind) {
        // The cast should be safe since the first if statement tests their the same kind,
        // and the above checks if they're the same extended kind.

        if (TypeUtils.isRecord(leftType)) {
            return unionRecordFields([leftType, rightType] as [Type.DefinedRecord, Type.DefinedRecord]);
        } else {
            return unionTableFields([leftType, rightType] as [Type.DefinedTable, Type.DefinedTable]);
        }
    } else {
        throw Assert.shouldNeverBeReachedTypescript();
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
    ...createLookupsForRelational(Type.TypeKind.Null),
    ...createLookupsForEquality(Type.TypeKind.Null),

    ...createLookupsForRelational(Type.TypeKind.Logical),
    ...createLookupsForEquality(Type.TypeKind.Logical),
    ...createLookupsForLogical(Type.TypeKind.Logical),

    ...createLookupsForRelational(Type.TypeKind.Number),
    ...createLookupsForEquality(Type.TypeKind.Number),
    ...createLookupsForArithmetic(Type.TypeKind.Number),

    ...createLookupsForRelational(Type.TypeKind.Time),
    ...createLookupsForEquality(Type.TypeKind.Time),
    ...createLookupsForClockKind(Type.TypeKind.Time),
    [lookupKey(Type.TypeKind.Date, Constant.ArithmeticOperator.And, Type.TypeKind.Time), Type.TypeKind.DateTime],

    ...createLookupsForRelational(Type.TypeKind.Date),
    ...createLookupsForEquality(Type.TypeKind.Date),
    ...createLookupsForClockKind(Type.TypeKind.Date),
    [lookupKey(Type.TypeKind.Date, Constant.ArithmeticOperator.And, Type.TypeKind.Time), Type.TypeKind.DateTime],

    ...createLookupsForRelational(Type.TypeKind.DateTime),
    ...createLookupsForEquality(Type.TypeKind.DateTime),
    ...createLookupsForClockKind(Type.TypeKind.DateTime),

    ...createLookupsForRelational(Type.TypeKind.DateTimeZone),
    ...createLookupsForEquality(Type.TypeKind.DateTimeZone),
    ...createLookupsForClockKind(Type.TypeKind.DateTimeZone),

    ...createLookupsForRelational(Type.TypeKind.Duration),
    ...createLookupsForEquality(Type.TypeKind.Duration),
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

    ...createLookupsForRelational(Type.TypeKind.Text),
    ...createLookupsForEquality(Type.TypeKind.Text),
    [lookupKey(Type.TypeKind.Text, Constant.ArithmeticOperator.And, Type.TypeKind.Text), Type.TypeKind.Text],

    ...createLookupsForRelational(Type.TypeKind.Binary),
    ...createLookupsForEquality(Type.TypeKind.Binary),

    ...createLookupsForEquality(Type.TypeKind.List),
    [lookupKey(Type.TypeKind.List, Constant.ArithmeticOperator.And, Type.TypeKind.List), Type.TypeKind.List],

    ...createLookupsForEquality(Type.TypeKind.Record),
    [lookupKey(Type.TypeKind.Record, Constant.ArithmeticOperator.And, Type.TypeKind.Record), Type.TypeKind.Record],

    ...createLookupsForEquality(Type.TypeKind.Table),
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
                const maybeValues: Set<Type.TypeKind> | undefined = binaryExpressionPartialLookup.get(partialKey);

                // First occurance of '<first operand> , <operator>'
                if (maybeValues === undefined) {
                    binaryExpressionPartialLookup.set(partialKey, new Set([potentialNewValue]));
                } else {
                    maybeValues.add(potentialNewValue);
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

function createLookupsForRelational(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.RelationalOperator.GreaterThan, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.RelationalOperator.GreaterThanEqualTo, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.RelationalOperator.LessThan, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.RelationalOperator.LessThanEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

function createLookupsForEquality(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.EqualityOperator.EqualTo, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Constant.EqualityOperator.NotEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

// Note: does not include the and <'&'> Constant.
function createLookupsForArithmetic(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.ArithmeticOperator.Addition, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Division, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Multiplication, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Subtraction, typeKind), typeKind],
    ];
}

function createLookupsForLogical(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.LogicalOperator.And, typeKind), typeKind],
        [lookupKey(typeKind, Constant.LogicalOperator.Or, typeKind), typeKind],
    ];
}

function createLookupsForClockKind(
    typeKind: Type.TypeKind.Date | Type.TypeKind.DateTime | Type.TypeKind.DateTimeZone | Type.TypeKind.Time,
): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Constant.ArithmeticOperator.Addition, Type.TypeKind.Duration), typeKind],
        [lookupKey(Type.TypeKind.Duration, Constant.ArithmeticOperator.Addition, typeKind), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Subtraction, Type.TypeKind.Duration), typeKind],
        [lookupKey(typeKind, Constant.ArithmeticOperator.Subtraction, typeKind), Type.TypeKind.Duration],
    ];
}
