// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

type TRecordOrTable =
    | PQP.Language.Type.Record
    | PQP.Language.Type.Table
    | PQP.Language.Type.DefinedRecord
    | PQP.Language.Type.DefinedTable;

export function inspectTypeTBinOpExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PqType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    Assert.isTrue(PQP.Language.AstUtils.isTBinOpExpressionKind(xorNode.node.kind), `xorNode isn't a TBinOpExpression`, {
        nodeId: xorNode.node.id,
        nodeKind: xorNode.node.kind,
    });

    const parentId: number = xorNode.node.id;
    const children: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.assertIterChildrenXor(
        state.nodeIdMapCollection,
        parentId,
    );

    const maybeLeft: PQP.Parser.TXorNode | undefined = children[0];
    const maybeOperatorKind: PQP.Language.Constant.TBinOpExpressionOperator | undefined =
        children[1] === undefined || children[1].kind === PQP.Parser.XorNodeKind.Context
            ? undefined
            : (children[1].node as PQP.Language.Ast.IConstant<PQP.Language.Constant.TBinOpExpressionOperator>)
                  .constantKind;
    const maybeRight: PQP.Parser.TXorNode | undefined = children[2];

    // ''
    if (maybeLeft === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }
    // '1'
    else if (maybeOperatorKind === undefined) {
        return inspectXor(state, maybeLeft);
    }
    // '1 +'
    else if (maybeRight === undefined || maybeRight.kind === PQP.Parser.XorNodeKind.Context) {
        const leftType: PQP.Language.Type.PqType = inspectXor(state, maybeLeft);
        const operatorKind: PQP.Language.Constant.TBinOpExpressionOperator = maybeOperatorKind;

        const key: string = partialLookupKey(leftType.kind, operatorKind);
        const maybeAllowedTypeKinds: ReadonlySet<PQP.Language.Type.TypeKind> | undefined = PartialLookup.get(key);
        if (maybeAllowedTypeKinds === undefined) {
            return PQP.Language.Type.NoneInstance;
        } else if (maybeAllowedTypeKinds.size === 1) {
            return PQP.Language.TypeUtils.primitiveTypeFactory(
                leftType.isNullable,
                maybeAllowedTypeKinds.values().next().value,
            );
        } else {
            const unionedTypePairs: PQP.Language.Type.PqType[] = [];
            for (const kind of maybeAllowedTypeKinds.values()) {
                unionedTypePairs.push({
                    kind,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                });
            }
            return PQP.Language.TypeUtils.anyUnionFactory(unionedTypePairs);
        }
    }
    // '1 + 1'
    else {
        const leftType: PQP.Language.Type.PqType = inspectXor(state, maybeLeft);
        const operatorKind: PQP.Language.Constant.TBinOpExpressionOperator = maybeOperatorKind;
        const rightType: PQP.Language.Type.PqType = inspectXor(state, maybeRight);

        const key: string = lookupKey(leftType.kind, operatorKind, rightType.kind);
        const maybeResultTypeKind: PQP.Language.Type.TypeKind | undefined = Lookup.get(key);
        if (maybeResultTypeKind === undefined) {
            return PQP.Language.Type.NoneInstance;
        }
        const resultTypeKind: PQP.Language.Type.TypeKind = maybeResultTypeKind;

        // '[foo = 1] & [bar = 2]'
        if (
            operatorKind === PQP.Language.Constant.ArithmeticOperatorKind.And &&
            (resultTypeKind === PQP.Language.Type.TypeKind.Record ||
                resultTypeKind === PQP.Language.Type.TypeKind.Table)
        ) {
            return inspectRecordOrTableUnion(leftType as TRecordOrTable, rightType as TRecordOrTable);
        } else {
            return PQP.Language.TypeUtils.primitiveTypeFactory(
                leftType.isNullable || rightType.isNullable,
                resultTypeKind,
            );
        }
    }
}

function inspectRecordOrTableUnion(leftType: TRecordOrTable, rightType: TRecordOrTable): PQP.Language.Type.PqType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new PQP.CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []' or '#table() & #table()'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return PQP.Language.TypeUtils.primitiveTypeFactory(leftType.isNullable || rightType.isNullable, leftType.kind);
    }
    // '[key=value] & []' or '#table(...) & #table()`
    // '[] & [key=value]' or `#table() & #table(...)`
    else if (
        (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind === undefined) ||
        (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind !== undefined)
    ) {
        // The 'rightType as (...)' isn't needed, except TypeScript's checker isn't smart enough to know it.
        const extendedType: PQP.Language.Type.DefinedRecord | PQP.Language.Type.DefinedTable =
            leftType.maybeExtendedKind !== undefined
                ? leftType
                : (rightType as PQP.Language.Type.DefinedRecord | PQP.Language.Type.DefinedTable);
        return {
            ...extendedType,
            isOpen: true,
        };
    }
    // '[foo=value] & [bar=value] or #table(...) & #table(...)'
    else if (leftType?.maybeExtendedKind === rightType?.maybeExtendedKind) {
        // The cast should be safe since the first if statement tests their the same kind,
        // and the above checks if they're the same extended kind.
        return unionFields([leftType, rightType] as
            | [PQP.Language.Type.DefinedRecord, PQP.Language.Type.DefinedRecord]
            | [PQP.Language.Type.DefinedTable, PQP.Language.Type.DefinedTable]);
    } else {
        throw Assert.shouldNeverBeReachedTypescript();
    }
}

function unionFields([leftType, rightType]:
    | [PQP.Language.Type.DefinedRecord, PQP.Language.Type.DefinedRecord]
    | [PQP.Language.Type.DefinedTable, PQP.Language.Type.DefinedTable]):
    | PQP.Language.Type.DefinedRecord
    | PQP.Language.Type.DefinedTable {
    const combinedFields: Map<string, PQP.Language.Type.PqType> = new Map(leftType.fields);
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
// Eg. '1 > 3' -> PQP.Language.Type.TypeKind.Number
export const Lookup: ReadonlyMap<string, PQP.Language.Type.TypeKind> = new Map([
    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Null),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Null),

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Logical),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Logical),
    ...lookupsForLogicalFactory(PQP.Language.Type.TypeKind.Logical),

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Number),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Number),
    ...lookupsForArithmeticFactory(PQP.Language.Type.TypeKind.Number),

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Time),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Time),
    ...lookupsForClockKindFactory(PQP.Language.Type.TypeKind.Time),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Date,
            PQP.Language.Constant.ArithmeticOperatorKind.And,
            PQP.Language.Type.TypeKind.Time,
        ),
        PQP.Language.Type.TypeKind.DateTime,
    ],

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Date),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Date),
    ...lookupsForClockKindFactory(PQP.Language.Type.TypeKind.Date),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Date,
            PQP.Language.Constant.ArithmeticOperatorKind.And,
            PQP.Language.Type.TypeKind.Time,
        ),
        PQP.Language.Type.TypeKind.DateTime,
    ],

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.DateTime),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.DateTime),
    ...lookupsForClockKindFactory(PQP.Language.Type.TypeKind.DateTime),

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.DateTimeZone),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.DateTimeZone),
    ...lookupsForClockKindFactory(PQP.Language.Type.TypeKind.DateTimeZone),

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Duration),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Duration),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Duration,
            PQP.Language.Constant.ArithmeticOperatorKind.Addition,
            PQP.Language.Type.TypeKind.Duration,
        ),
        PQP.Language.Type.TypeKind.Duration,
    ],
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Duration,
            PQP.Language.Constant.ArithmeticOperatorKind.Subtraction,
            PQP.Language.Type.TypeKind.Duration,
        ),
        PQP.Language.Type.TypeKind.Duration,
    ],
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Duration,
            PQP.Language.Constant.ArithmeticOperatorKind.Multiplication,
            PQP.Language.Type.TypeKind.Number,
        ),
        PQP.Language.Type.TypeKind.Duration,
    ],
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Number,
            PQP.Language.Constant.ArithmeticOperatorKind.Multiplication,
            PQP.Language.Type.TypeKind.Duration,
        ),
        PQP.Language.Type.TypeKind.Duration,
    ],
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Duration,
            PQP.Language.Constant.ArithmeticOperatorKind.Division,
            PQP.Language.Type.TypeKind.Number,
        ),
        PQP.Language.Type.TypeKind.Duration,
    ],

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Text),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Text),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Text,
            PQP.Language.Constant.ArithmeticOperatorKind.And,
            PQP.Language.Type.TypeKind.Text,
        ),
        PQP.Language.Type.TypeKind.Text,
    ],

    ...lookupsForRelationalFactory(PQP.Language.Type.TypeKind.Binary),
    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Binary),

    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.List),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.List,
            PQP.Language.Constant.ArithmeticOperatorKind.And,
            PQP.Language.Type.TypeKind.List,
        ),
        PQP.Language.Type.TypeKind.List,
    ],

    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Record),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Record,
            PQP.Language.Constant.ArithmeticOperatorKind.And,
            PQP.Language.Type.TypeKind.Record,
        ),
        PQP.Language.Type.TypeKind.Record,
    ],

    ...lookupsForEqualityFactory(PQP.Language.Type.TypeKind.Table),
    [
        lookupKey(
            PQP.Language.Type.TypeKind.Table,
            PQP.Language.Constant.ArithmeticOperatorKind.And,
            PQP.Language.Type.TypeKind.Table,
        ),
        PQP.Language.Type.TypeKind.Table,
    ],
]);

// Keys: <first operand> <operator>
// Values: a set of types that are allowed for <second operand>
// Eg. '1 + ' ->
export const PartialLookup: ReadonlyMap<string, ReadonlySet<PQP.Language.Type.TypeKind>> = new Map(
    // Grab the keys
    [...Lookup.keys()]
        .reduce(
            (
                binaryExpressionPartialLookup: Map<string, Set<PQP.Language.Type.TypeKind>>,
                key: string,
                _currentIndex,
                _array,
            ): Map<string, Set<PQP.Language.Type.TypeKind>> => {
                const lastDeliminatorIndex: number = key.lastIndexOf(",");
                // Grab '<first operand> , <operator>'.
                const partialKey: string = key.slice(0, lastDeliminatorIndex);
                // Grab '<second operand>'.
                const potentialNewValue: PQP.Language.Type.TypeKind = key.slice(
                    lastDeliminatorIndex + 1,
                ) as PQP.Language.Type.TypeKind;

                // Add the potentialNewValue if it's a new PQP.Language.type.
                const maybeValues: Set<PQP.Language.Type.TypeKind> | undefined = binaryExpressionPartialLookup.get(
                    partialKey,
                );
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
    leftTypeKind: PQP.Language.Type.TypeKind,
    operatorKind: PQP.Language.Constant.TBinOpExpressionOperator,
    rightTypeKind: PQP.Language.Type.TypeKind,
): string {
    return `${leftTypeKind},${operatorKind},${rightTypeKind}`;
}

export function partialLookupKey(
    leftTypeKind: PQP.Language.Type.TypeKind,
    operatorKind: PQP.Language.Constant.TBinOpExpressionOperator,
): string {
    return `${leftTypeKind},${operatorKind}`;
}

function lookupsForRelationalFactory(
    typeKind: PQP.Language.Type.TypeKind,
): ReadonlyArray<[string, PQP.Language.Type.TypeKind]> {
    return [
        [
            lookupKey(typeKind, PQP.Language.Constant.RelationalOperatorKind.GreaterThan, typeKind),
            PQP.Language.Type.TypeKind.Logical,
        ],
        [
            lookupKey(typeKind, PQP.Language.Constant.RelationalOperatorKind.GreaterThanEqualTo, typeKind),
            PQP.Language.Type.TypeKind.Logical,
        ],
        [
            lookupKey(typeKind, PQP.Language.Constant.RelationalOperatorKind.LessThan, typeKind),
            PQP.Language.Type.TypeKind.Logical,
        ],
        [
            lookupKey(typeKind, PQP.Language.Constant.RelationalOperatorKind.LessThanEqualTo, typeKind),
            PQP.Language.Type.TypeKind.Logical,
        ],
    ];
}

function lookupsForEqualityFactory(
    typeKind: PQP.Language.Type.TypeKind,
): ReadonlyArray<[string, PQP.Language.Type.TypeKind]> {
    return [
        [
            lookupKey(typeKind, PQP.Language.Constant.EqualityOperatorKind.EqualTo, typeKind),
            PQP.Language.Type.TypeKind.Logical,
        ],
        [
            lookupKey(typeKind, PQP.Language.Constant.EqualityOperatorKind.NotEqualTo, typeKind),
            PQP.Language.Type.TypeKind.Logical,
        ],
    ];
}

// Note: does not include the and <'&'> Constant.
function lookupsForArithmeticFactory(
    typeKind: PQP.Language.Type.TypeKind,
): ReadonlyArray<[string, PQP.Language.Type.TypeKind]> {
    return [
        [lookupKey(typeKind, PQP.Language.Constant.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [lookupKey(typeKind, PQP.Language.Constant.ArithmeticOperatorKind.Division, typeKind), typeKind],
        [lookupKey(typeKind, PQP.Language.Constant.ArithmeticOperatorKind.Multiplication, typeKind), typeKind],
        [lookupKey(typeKind, PQP.Language.Constant.ArithmeticOperatorKind.Subtraction, typeKind), typeKind],
    ];
}

function lookupsForLogicalFactory(
    typeKind: PQP.Language.Type.TypeKind,
): ReadonlyArray<[string, PQP.Language.Type.TypeKind]> {
    return [
        [lookupKey(typeKind, PQP.Language.Constant.LogicalOperatorKind.And, typeKind), typeKind],
        [lookupKey(typeKind, PQP.Language.Constant.LogicalOperatorKind.Or, typeKind), typeKind],
    ];
}

function lookupsForClockKindFactory(
    typeKind:
        | PQP.Language.Type.TypeKind.Date
        | PQP.Language.Type.TypeKind.DateTime
        | PQP.Language.Type.TypeKind.DateTimeZone
        | PQP.Language.Type.TypeKind.Time,
): ReadonlyArray<[string, PQP.Language.Type.TypeKind]> {
    return [
        [
            lookupKey(
                typeKind,
                PQP.Language.Constant.ArithmeticOperatorKind.Addition,
                PQP.Language.Type.TypeKind.Duration,
            ),
            typeKind,
        ],
        [
            lookupKey(
                PQP.Language.Type.TypeKind.Duration,
                PQP.Language.Constant.ArithmeticOperatorKind.Addition,
                typeKind,
            ),
            typeKind,
        ],
        [
            lookupKey(
                typeKind,
                PQP.Language.Constant.ArithmeticOperatorKind.Subtraction,
                PQP.Language.Type.TypeKind.Duration,
            ),
            typeKind,
        ],
        [
            lookupKey(typeKind, PQP.Language.Constant.ArithmeticOperatorKind.Subtraction, typeKind),
            PQP.Language.Type.TypeKind.Duration,
        ],
    ];
}
