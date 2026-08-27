// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, TextUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";
import { MaxDefinedTableRows } from "./definedTableUtils";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeHashTableInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeHashTableInvokeExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();

    if (state.typeStrategy === TypeStrategy.Primitive) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.TableInstance) });

        return Type.TableInstance;
    }

    const [columns, rows]: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression),
    );

    if (columns === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.TableInstance) });

        return Type.TableInstance;
    }

    const columnsType: Type.TPowerQueryType = await inspectXor(state, columns, trace.id);

    const rowsType: Type.TPowerQueryType | undefined =
        rows === undefined ? undefined : await inspectXor(state, rows, trace.id);

    const result: Type.TPowerQueryType = definedTableFromConstructorTypes(state, columnsType, rowsType, trace.id);

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function definedTableFromConstructorTypes(
    state: InspectTypeState,
    columnsType: Type.TPowerQueryType,
    rowsType: Type.TPowerQueryType | undefined,
    correlationId: number | undefined,
): Type.Table | Type.DefinedTable {
    const fields: Type.OrderedFields | undefined = definedTableFields(columnsType);

    if (fields === undefined) {
        return Type.TableInstance;
    }

    const rows: ReadonlyArray<Type.UnorderedFields> | undefined = definedTableRows([...fields.keys()], rowsType);

    const canRetainRows: boolean =
        rows !== undefined &&
        (columnsType.extendedKind !== Type.ExtendedTypeKind.TableType ||
            areTableRowsCompatible(state, fields, rows, correlationId));

    return TypeUtils.definedTable(false, fields, canRetainRows ? rows : undefined);
}

function definedTableFields(columnsType: Type.TPowerQueryType): Type.OrderedFields | undefined {
    if (columnsType.extendedKind === Type.ExtendedTypeKind.TableType) {
        return columnsType.isOpen ? undefined : new PQP.OrderedMap(columnsType.fields);
    }

    if (columnsType.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return undefined;
    }

    const fields: Type.OrderedFields = new PQP.OrderedMap();

    for (const element of columnsType.elements) {
        if (element.extendedKind !== Type.ExtendedTypeKind.TextLiteral) {
            return undefined;
        }

        // Convert the quoted M text literal to its unescaped column name.
        const fieldName: string = TextUtils.unescape(element.literal.slice(1, -1));

        if (fields.has(fieldName)) {
            return undefined;
        }

        fields.set(fieldName, Type.AnyInstance);
    }

    return fields;
}

function definedTableRows(
    columnNames: ReadonlyArray<string>,
    rowsType: Type.TPowerQueryType | undefined,
): ReadonlyArray<Type.UnorderedFields> | undefined {
    if (
        rowsType?.extendedKind !== Type.ExtendedTypeKind.DefinedList ||
        rowsType.elements.length > MaxDefinedTableRows
    ) {
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

function areTableRowsCompatible(
    state: InspectTypeState,
    fields: Type.OrderedFields,
    rows: ReadonlyArray<Type.UnorderedFields>,
    correlationId: number | undefined,
): boolean {
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
                return false;
            }
        }
    }

    return true;
}
