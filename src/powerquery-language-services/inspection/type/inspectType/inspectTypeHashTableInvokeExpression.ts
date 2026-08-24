// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, TextUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

const MaxDefinedTableRows: number = 100;

export async function inspectTypeHashTableInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    if (state.typeStrategy === TypeStrategy.Primitive) {
        return Type.TableInstance;
    }

    const [columns, rows]: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression),
    );

    if (columns === undefined) {
        return Type.TableInstance;
    }

    const columnsType: Type.TPowerQueryType = await inspectXor(state, columns, correlationId);

    const rowsType: Type.TPowerQueryType | undefined =
        rows === undefined ? undefined : await inspectXor(state, rows, correlationId);

    return definedTableFromConstructorTypes(state, columnsType, rowsType, correlationId);
}

function definedTableFromConstructorTypes(
    state: InspectTypeState,
    columnsType: Type.TPowerQueryType,
    rowsType: Type.TPowerQueryType | undefined,
    correlationId: number | undefined,
): Type.Table | Type.DefinedTable {
    if (columnsType.extendedKind === Type.ExtendedTypeKind.TableType) {
        if (columnsType.isOpen) {
            return Type.TableInstance;
        }

        const fields: Type.OrderedFields = new PQP.OrderedMap(columnsType.fields);

        const rows: ReadonlyArray<Type.UnorderedFields> | undefined = retainedTableRows(
            state,
            definedTableRows([...fields.keys()], rowsType),
            correlationId,
            fields,
        );

        return rows === undefined ? Type.TableInstance : TypeUtils.definedTable(false, fields, rows);
    }

    if (columnsType.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return Type.TableInstance;
    }

    const columnNames: string[] = [];

    for (const element of columnsType.elements) {
        if (element.extendedKind !== Type.ExtendedTypeKind.TextLiteral) {
            return Type.TableInstance;
        }

        // Convert the quoted M text literal to its unescaped column name.
        const fieldName: string = TextUtils.unescape(element.literal.slice(1, -1));

        if (columnNames.includes(fieldName)) {
            return Type.TableInstance;
        }

        columnNames.push(fieldName);
    }

    const rows: ReadonlyArray<Type.UnorderedFields> | undefined = retainedTableRows(
        state,
        definedTableRows(columnNames, rowsType),
        correlationId,
    );

    if (rows === undefined) {
        return Type.TableInstance;
    }

    const fields: Type.OrderedFields = inferredTableFields(state, columnNames, rows, correlationId);

    return TypeUtils.definedTable(false, fields, rows);
}

function definedTableRows(
    columnNames: ReadonlyArray<string>,
    rowsType: Type.TPowerQueryType | undefined,
): ReadonlyArray<Type.UnorderedFields> | undefined {
    if (rowsType?.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return undefined;
    }

    const rows: Type.UnorderedFields[] = [];

    for (const rowType of rowsType.elements) {
        if (
            rowType.extendedKind !== Type.ExtendedTypeKind.DefinedList ||
            rowType.elements.length !== columnNames.length
        ) {
            return undefined;
        }

        rows.push(
            new Map(
                columnNames.map((columnName: string, index: number) => [
                    columnName,
                    Assert.asDefined(rowType.elements[index]),
                ]),
            ),
        );
    }

    return rows;
}

function inferredTableFields(
    state: InspectTypeState,
    columnNames: ReadonlyArray<string>,
    rows: ReadonlyArray<Type.UnorderedFields>,
    correlationId: number | undefined,
): Type.OrderedFields {
    return new PQP.OrderedMap(
        columnNames.map((columnName: string): [string, Type.TPowerQueryType] => {
            const columnTypes: ReadonlyArray<Type.TPowerQueryType> = rows.map((row: Type.UnorderedFields) =>
                Assert.asDefined(row.get(columnName)),
            );

            return [
                columnName,
                columnTypes.length === 0
                    ? Type.AnyInstance
                    : TypeUtils.anyUnion(columnTypes.map(widenLiteralType), state.traceManager, correlationId),
            ];
        }),
    );
}

function widenLiteralType(type: Type.TPowerQueryType): Type.TPowerQueryType {
    if (
        type.extendedKind === Type.ExtendedTypeKind.LogicalLiteral ||
        type.extendedKind === Type.ExtendedTypeKind.NumberLiteral ||
        type.extendedKind === Type.ExtendedTypeKind.TextLiteral
    ) {
        return TypeUtils.primitiveType(type.isNullable, type.kind);
    }

    return type;
}

function retainedTableRows(
    state: InspectTypeState,
    rows: ReadonlyArray<Type.UnorderedFields> | undefined,
    correlationId: number | undefined,
    fields?: Type.OrderedFields,
): ReadonlyArray<Type.UnorderedFields> | undefined {
    if (rows === undefined || rows.length > MaxDefinedTableRows) {
        return undefined;
    }

    if (fields !== undefined) {
        for (const row of rows) {
            for (const [fieldName, fieldType] of fields) {
                if (
                    TypeUtils.isCompatible(
                        Assert.asDefined(row.get(fieldName)),
                        fieldType,
                        state.traceManager,
                        correlationId,
                    ) !== true
                ) {
                    return undefined;
                }
            }
        }
    }

    return rows;
}
