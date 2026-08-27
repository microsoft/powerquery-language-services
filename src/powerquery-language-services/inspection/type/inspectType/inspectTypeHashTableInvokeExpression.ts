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

    const rows: ReadonlyArray<Type.UnorderedFields> | undefined = definedTableRows(
        state,
        fields,
        rowsType,
        columnsType.extendedKind === Type.ExtendedTypeKind.TableType,
        correlationId,
    );

    return TypeUtils.definedTable(false, fields, rows);
}

function definedTableFields(columnsType: Type.TPowerQueryType): Type.OrderedFields | undefined {
    // '#table(type table [Name = text], rows)'
    if (columnsType.extendedKind === Type.ExtendedTypeKind.TableType) {
        return columnsType.isOpen ? undefined : new PQP.OrderedMap(columnsType.fields);
    }

    // 'let columns = {} as list in #table(columns, {})'
    if (columnsType.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return undefined;
    }

    const fields: Type.OrderedFields = new PQP.OrderedMap();

    for (const element of columnsType.elements) {
        // '#table({"Name", 1}, {})'
        if (element.extendedKind !== Type.ExtendedTypeKind.TextLiteral) {
            return undefined;
        }

        // Convert the quoted M text literal to its unescaped column name.
        const fieldName: string = TextUtils.unescape(element.literal.slice(1, -1));

        // '#table({"Name", "Name"}, {})'
        if (fields.has(fieldName)) {
            return undefined;
        }

        fields.set(fieldName, Type.AnyInstance);
    }

    return fields;
}

function definedTableRows(
    state: InspectTypeState,
    fields: Type.OrderedFields,
    rowsType: Type.TPowerQueryType | undefined,
    validateRowTypes: boolean,
    correlationId: number | undefined,
): ReadonlyArray<Type.UnorderedFields> | undefined {
    // 'let rows = {} as list in #table({"Name"}, rows)'
    if (
        rowsType?.extendedKind !== Type.ExtendedTypeKind.DefinedList ||
        rowsType.elements.length > MaxDefinedTableRows
    ) {
        return undefined;
    }

    const rows: Type.UnorderedFields[] = [];

    for (const rowType of rowsType.elements) {
        // '#table({"Name"}, {{"Betty", 42}})'
        if (rowType.extendedKind !== Type.ExtendedTypeKind.DefinedList || rowType.elements.length !== fields.size) {
            return undefined;
        }

        const row: Type.UnorderedFields = new Map();

        for (const [index, [fieldName, fieldType]] of [...fields].entries()) {
            const valueType: Type.TPowerQueryType = Assert.asDefined(rowType.elements[index]);

            // '#table(type table [Value = number], {{"text"}})'
            if (
                validateRowTypes &&
                TypeUtils.isCompatible(valueType, fieldType, state.traceManager, correlationId) !== true
            ) {
                return undefined;
            }

            row.set(fieldName, valueType);
        }

        rows.push(row);
    }

    return rows;
}
