// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, AstUtils, Constant, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";
import { MaxDefinedTableRows } from "./definedTableUtils";

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
        children[1] === undefined || XorNodeUtils.isContext(children[1])
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
    else if (right === undefined || XorNodeUtils.isContext(right)) {
        const leftType: Type.TPowerQueryType = await inspectXor(state, left, trace.id);

        const key: string = partialLookupKey(leftType.kind, operatorKind);
        const allowedTypeKinds: ReadonlySet<Type.TypeKind> | undefined = PartialLookup.get(key);

        if (allowedTypeKinds === undefined) {
            result = Type.NoneInstance;
        } else if (allowedTypeKinds.size === 1) {
            result = TypeUtils.primitiveType(
                leftType.isNullable,
                Assert.asDefined(
                    allowedTypeKinds.values().next().value,
                    "allowedTypeKinds had a size of 1, so there should be a value here.",
                ),
            );
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

        // Only a definite false for `and` or true for `or` makes the right operand unreachable.
        // Otherwise its type (including any error) still matters.
        if (
            (operatorKind === Constant.LogicalOperator.And || operatorKind === Constant.LogicalOperator.Or) &&
            leftType.kind === Type.TypeKind.Logical &&
            !leftType.isNullable &&
            logicalValue(left, leftType) === (operatorKind === Constant.LogicalOperator.Or)
        ) {
            result = leftType;
        } else {
            const rightType: Type.TPowerQueryType = await inspectXor(state, right, trace.id);
            // With a null operand, the opposite boolean's value can distinguish a logical result from null.
            result = inspectBinaryOperation(
                state,
                rightType.kind === Type.TypeKind.Null ? refineLogicalLiteral(left, leftType) : leftType,
                operatorKind,
                leftType.kind === Type.TypeKind.Null ? refineLogicalLiteral(right, rightType) : rightType,
                trace.id,
            );
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function refineLogicalLiteral(operand: TXorNode, type: Type.TPowerQueryType): Type.TPowerQueryType {
    if (type.kind !== Type.TypeKind.Logical || TypeUtils.isLogicalLiteral(type)) {
        return type;
    }

    const value: boolean | undefined = logicalValue(operand, type);
    return value === undefined ? type : TypeUtils.logicalLiteral(type.isNullable, value);
}

function logicalValue(operand: TXorNode, type: Type.TLogical): boolean | undefined {
    // Prefer the inferred literal. If inference retained only `logical`, the syntax may still give its value.
    if (TypeUtils.isLogicalLiteral(type)) {
        return type.normalizedLiteral;
    } else if (XorNodeUtils.isAst(operand)) {
        let node: Ast.TNode = operand.node;

        // Parentheses preserve the value; other expressions cannot be assumed true or false from syntax alone.
        while (node.kind === Ast.NodeKind.ParenthesizedExpression) {
            node = node.content;
        }

        if (node.kind === Ast.NodeKind.LiteralExpression && node.literalKind === Ast.LiteralKind.Logical) {
            return node.literal === "true";
        }
    }

    return undefined;
}

function inspectBinaryOperation(
    state: InspectTypeState,
    leftType: Type.TPowerQueryType,
    operatorKind: Constant.TBinOpExpressionOperator,
    rightType: Type.TPowerQueryType,
    correlationId: number,
): Type.TPowerQueryType {
    if (TypeUtils.isAnyUnion(leftType)) {
        return TypeUtils.anyUnion(
            leftType.unionedTypePairs.map((member: Type.TPowerQueryType) =>
                inspectBinaryOperation(
                    state,
                    leftType.isNullable ? { ...member, isNullable: true } : member,
                    operatorKind,
                    rightType,
                    correlationId,
                ),
            ),
            state.traceManager,
            correlationId,
        );
    } else if (TypeUtils.isAnyUnion(rightType)) {
        return TypeUtils.anyUnion(
            rightType.unionedTypePairs.map((member: Type.TPowerQueryType) =>
                inspectBinaryOperation(
                    state,
                    leftType,
                    operatorKind,
                    rightType.isNullable ? { ...member, isNullable: true } : member,
                    correlationId,
                ),
            ),
            state.traceManager,
            correlationId,
        );
    }

    if (operatorKind === Constant.EqualityOperator.EqualTo || operatorKind === Constant.EqualityOperator.NotEqualTo) {
        // Compare each union alternative before combining results so errors are retained.
        return Type.TypeKinds.includes(leftType.kind) && Type.TypeKinds.includes(rightType.kind)
            ? Type.LogicalInstance
            : Type.NoneInstance;
    }

    // A plain any describes runtime alternatives, not a concrete operand kind in the operator table.
    if (leftType.kind === Type.TypeKind.Any || rightType.kind === Type.TypeKind.Any) {
        const expandLeft: boolean = leftType.kind === Type.TypeKind.Any;

        return TypeUtils.anyUnion(
            ConcreteOperandTypes.map((operand: Type.TPrimitiveType) =>
                inspectBinaryOperation(
                    state,
                    expandLeft ? operand : leftType,
                    operatorKind,
                    expandLeft ? rightType : operand,
                    correlationId,
                ),
            ),
            state.traceManager,
            correlationId,
        );
    }

    const key: string = lookupKey(leftType.kind, operatorKind, rightType.kind);

    // A null operand is not just a nullable result: the operator and the other operand determine validity.
    if (leftType.kind === Type.TypeKind.Null || rightType.kind === Type.TypeKind.Null) {
        const nullOnLeft: boolean = leftType.kind === Type.TypeKind.Null;
        const other: Type.TPowerQueryType = nullOnLeft ? rightType : leftType;

        switch (operatorKind) {
            case Constant.LogicalOperator.And:
            case Constant.LogicalOperator.Or:
                // Two nulls yield null. With a logical partner, only false for `and` or true for `or` overrides null.
                if (other.kind === Type.TypeKind.Null) {
                    return Type.NullInstance;
                } else if (!TypeUtils.isLogical(other)) {
                    return Type.NoneInstance;
                } else if (TypeUtils.isLogicalLiteral(other) && !other.isNullable) {
                    return other.normalizedLiteral === (operatorKind === Constant.LogicalOperator.Or)
                        ? Type.LogicalInstance
                        : Type.NullInstance;
                }

                // Without a definite boolean value, both logical and null outcomes remain possible.
                return Type.NullableLogicalInstance;

            case Constant.RelationalOperator.LessThan:
            case Constant.RelationalOperator.LessThanEqualTo:
            case Constant.RelationalOperator.GreaterThan:
            case Constant.RelationalOperator.GreaterThanEqualTo:
                // Null propagates only for comparable kinds; it cannot make a list or record orderable.
                return Lookup.has(lookupKey(other.kind, operatorKind, other.kind))
                    ? Type.NullInstance
                    : Type.NoneInstance;

            case Constant.ArithmeticOperator.Addition:
            case Constant.ArithmeticOperator.Subtraction:
                // Unlike multiplication and division, addition and subtraction also admit date and time kinds.
                if (
                    [
                        Type.TypeKind.Date,
                        Type.TypeKind.DateTime,
                        Type.TypeKind.DateTimeZone,
                        Type.TypeKind.Time,
                    ].includes(other.kind)
                ) {
                    return Type.NullInstance;
                }

                return other.kind === Type.TypeKind.Number || other.kind === Type.TypeKind.Duration
                    ? Type.NullInstance
                    : Type.NoneInstance;

            case Constant.ArithmeticOperator.Division:
            case Constant.ArithmeticOperator.Multiplication:
                // Only numbers and durations have scaling or quotient operations with a null operand.
                return other.kind === Type.TypeKind.Number || other.kind === Type.TypeKind.Duration
                    ? Type.NullInstance
                    : Type.NoneInstance;

            case Constant.ArithmeticOperator.And:
                // Text concatenation accepts null on either side; date & time keeps its operand order.
                return other.kind === Type.TypeKind.Text ||
                    other.kind === (nullOnLeft ? Type.TypeKind.Time : Type.TypeKind.Date)
                    ? Type.NullInstance
                    : Type.NoneInstance;
            default:
                return Type.NoneInstance;
        }
    }

    const resultTypeKind: Type.TypeKind | undefined = Lookup.get(key);

    if (resultTypeKind === undefined) {
        return Type.NoneInstance;
    } else if (
        operatorKind === Constant.ArithmeticOperator.And &&
        TypeUtils.isRecord(leftType) &&
        TypeUtils.isRecord(rightType)
    ) {
        return inspectRecordUnion(leftType, rightType);
    } else if (
        operatorKind === Constant.ArithmeticOperator.And &&
        TypeUtils.isTable(leftType) &&
        TypeUtils.isTable(rightType)
    ) {
        return inspectTableUnion(state, leftType, rightType, correlationId);
    } else {
        return TypeUtils.primitiveType(leftType.isNullable || rightType.isNullable, resultTypeKind);
    }
}

function inspectRecordUnion(leftType: Type.TRecord, rightType: Type.TRecord): Type.TRecord {
    // '[foo=value] & [bar=value]'
    if (TypeUtils.isDefinedRecord(leftType) && TypeUtils.isDefinedRecord(rightType)) {
        return unionRecordFields([leftType, rightType]);
    }

    // '[key=value] & []'
    if (TypeUtils.isDefinedRecord(leftType)) {
        return {
            ...leftType,
            isOpen: true,
        };
    }

    // '[] & [key=value]'
    if (TypeUtils.isDefinedRecord(rightType)) {
        return {
            ...rightType,
            isOpen: true,
        };
    }

    // '[] & []'
    return leftType.isNullable || rightType.isNullable ? Type.NullableRecordInstance : Type.RecordInstance;
}

function inspectTableUnion(
    state: InspectTypeState,
    leftType: Type.TTable,
    rightType: Type.TTable,
    correlationId: number,
): Type.TTable {
    // '#table(...) & #table(...)'
    if (TypeUtils.isDefinedTable(leftType) && TypeUtils.isDefinedTable(rightType)) {
        return unionTables(state, leftType, rightType, correlationId);
    }

    // '#table(...) & #table()'
    if (TypeUtils.isDefinedTable(leftType)) {
        return leftType.isNullable ? Type.NullableTableInstance : Type.TableInstance;
    }

    // '#table() & #table(...)'
    if (TypeUtils.isDefinedTable(rightType)) {
        return rightType.isNullable ? Type.NullableTableInstance : Type.TableInstance;
    }

    // '#table() & #table()'
    return leftType.isNullable || rightType.isNullable ? Type.NullableTableInstance : Type.TableInstance;
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

function unionTables(
    state: InspectTypeState,
    leftType: Type.DefinedTable,
    rightType: Type.DefinedTable,
    correlationId: number,
): Type.Table | Type.DefinedTable {
    const isNullable: boolean = leftType.isNullable && rightType.isNullable;

    if (leftType.isOpen || rightType.isOpen) {
        return isNullable ? Type.NullableTableInstance : Type.TableInstance;
    }

    const fields: Type.OrderedFields = unionTableFields(state, [leftType, rightType], correlationId);

    let rows: ReadonlyArray<Type.UnorderedFields> | undefined;

    if (
        leftType.rows !== undefined &&
        rightType.rows !== undefined &&
        leftType.rows.length + rightType.rows.length <= MaxDefinedTableRows
    ) {
        rows = [...leftType.rows, ...rightType.rows].map((row: Type.UnorderedFields) => normalizeTableRow(row, fields));
    }

    return TypeUtils.definedTable(isNullable, fields, rows);
}

// '#table(type table [A = number], {{1}}) & #table(type table [B = text], {{"two"}})'
// produces fields [A = nullable number, B = nullable text].
function unionTableFields(
    state: InspectTypeState,
    [leftType, rightType]: [Type.DefinedTable, Type.DefinedTable],
    correlationId: number,
): Type.OrderedFields {
    const combinedFields: Type.OrderedFields = new PQP.OrderedMap([...leftType.fields]);

    for (const [key, value] of leftType.fields.entries()) {
        combinedFields.set(
            key,
            TypeUtils.anyUnion(
                [value, rightType.fields.get(key) ?? Type.NullInstance],
                state.traceManager,
                correlationId,
            ),
        );
    }

    for (const [key, value] of rightType.fields.entries()) {
        if (!combinedFields.has(key)) {
            combinedFields.set(key, TypeUtils.anyUnion([value, Type.NullInstance], state.traceManager, correlationId));
        }
    }

    return combinedFields;
}

// Against fields [A, B], row [A = 1] becomes [A = 1, B = null].
function normalizeTableRow(row: Type.UnorderedFields, fields: Type.OrderedFields): Type.UnorderedFields {
    const normalizedRow: Type.UnorderedFields = new Map();

    for (const fieldName of fields.keys()) {
        normalizedRow.set(fieldName, row.get(fieldName) ?? Type.NullInstance);
    }

    return normalizedRow;
}

const ConcreteOperandTypes: ReadonlyArray<Type.TPrimitiveType> = Type.TypeKinds.filter(
    (kind: Type.TypeKind) => kind !== Type.TypeKind.Any && kind !== Type.TypeKind.AnyNonNull,
).map((kind: Type.TypeKind) => TypeUtils.primitiveType(kind === Type.TypeKind.Null, kind));

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

                // First occurrence of '<first operand> , <operator>'
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
