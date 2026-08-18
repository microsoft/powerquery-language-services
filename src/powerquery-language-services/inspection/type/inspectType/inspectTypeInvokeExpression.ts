// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { Ast, Keyword, TextUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { DereferencedIdentifierKind, TDereferencedIdentifier } from "../../dereferencedIdentifier";
import { ExternalType, ExternalTypeUtils } from "../../../externalType";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, InspectTypeStateUtils } from "./inspectTypeState";
import { inspectXor } from "./common";
import { tryBuildDereferencedIdentifierPath } from "../../dereferencedIdentifier/dereferencedIdentifierUtils";
import { TypeStrategy } from "../../../inspectionSettings";

const MaxDefinedTableRows: number = 100;

export async function inspectTypeInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeInvokeExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression);

    const intrinsicType: Type.TPowerQueryType | undefined = await inspectIntrinsicInvokeExpression(
        state,
        xorNode,
        trace.id,
    );

    if (intrinsicType !== undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(intrinsicType) });

        return intrinsicType;
    }

    const request: ExternalType.ExternalInvocationTypeRequest | undefined = await externalInvokeRequest(
        state,
        xorNode,
        trace.id,
    );

    if (request !== undefined) {
        const type: Type.TPowerQueryType | undefined = state.library.externalTypeResolver(request);

        if (type !== undefined) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(type) });

            return type;
        }
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    const previousSiblingType: Type.TPowerQueryType = await inspectXor(state, previousSibling, trace.id);

    let result: Type.TPowerQueryType;

    if (previousSiblingType.kind === Type.TypeKind.Any) {
        result = Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        result = Type.NoneInstance;
    } else if (previousSiblingType.extendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        result = previousSiblingType.returnType;
    } else {
        result = Type.AnyInstance;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

async function inspectIntrinsicInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType | undefined> {
    const identifier: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (
        identifier === undefined ||
        XorNodeUtils.isContext(identifier) ||
        identifier.node.identifier.literal !== Keyword.KeywordKind.HashTable
    ) {
        return undefined;
    }

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
        const fields: Type.OrderedFields = new PQP.OrderedMap(columnsType.fields);
        const rows: ReadonlyArray<Type.DefinedRecord> | undefined = definedTableRows([...fields.keys()], rowsType);

        return TypeUtils.definedTable(
            false,
            fields,
            columnsType.isOpen,
            retainedTableRows(state, rows, correlationId, fields),
        );
    }

    if (columnsType.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return Type.TableInstance;
    }

    const columnNames: string[] = [];

    for (const element of columnsType.elements) {
        if (element.extendedKind !== Type.ExtendedTypeKind.TextLiteral) {
            return Type.TableInstance;
        }

        const fieldName: string = TextUtils.unescape(element.literal.slice(1, -1));

        if (columnNames.includes(fieldName)) {
            return Type.TableInstance;
        }

        columnNames.push(fieldName);
    }

    const rows: ReadonlyArray<Type.DefinedRecord> | undefined = definedTableRows(columnNames, rowsType);
    const fields: Type.OrderedFields = inferredTableFields(state, columnNames, rows, correlationId);

    return TypeUtils.definedTable(false, fields, false, retainedTableRows(state, rows, correlationId));
}

function definedTableRows(
    columnNames: ReadonlyArray<string>,
    rowsType: Type.TPowerQueryType | undefined,
): ReadonlyArray<Type.DefinedRecord> | undefined {
    if (rowsType?.extendedKind !== Type.ExtendedTypeKind.DefinedList) {
        return undefined;
    }

    const rows: Type.DefinedRecord[] = [];

    for (const rowType of rowsType.elements) {
        if (
            rowType.extendedKind !== Type.ExtendedTypeKind.DefinedList ||
            rowType.elements.length !== columnNames.length
        ) {
            return undefined;
        }

        const fields: Map<string, Type.TPowerQueryType> = new Map(
            columnNames.map((columnName: string, index: number) => [
                columnName,
                Assert.asDefined(rowType.elements[index]),
            ]),
        );

        rows.push(TypeUtils.definedRecord(false, fields, false));
    }

    return rows;
}

function inferredTableFields(
    state: InspectTypeState,
    columnNames: ReadonlyArray<string>,
    rows: ReadonlyArray<Type.DefinedRecord> | undefined,
    correlationId: number | undefined,
): Type.OrderedFields {
    const entries: ReadonlyArray<[string, Type.TPowerQueryType]> = columnNames.map((columnName: string) => {
        const columnTypes: ReadonlyArray<Type.TPowerQueryType> | undefined = rows?.map((row: Type.DefinedRecord) =>
            Assert.asDefined(row.fields.get(columnName)),
        );

        return [
            columnName,
            columnTypes === undefined || columnTypes.length === 0
                ? Type.AnyInstance
                : TypeUtils.anyUnion(columnTypes.map(widenLiteralType), state.traceManager, correlationId),
        ];
    });

    return new PQP.OrderedMap(entries);
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
    rows: ReadonlyArray<Type.DefinedRecord> | undefined,
    correlationId: number | undefined,
    fields?: Type.OrderedFields,
): ReadonlyArray<Type.DefinedRecord> | undefined {
    if (rows === undefined || rows.length > MaxDefinedTableRows) {
        return undefined;
    }

    if (fields !== undefined) {
        for (const row of rows) {
            for (const [fieldName, fieldType] of fields) {
                if (
                    TypeUtils.isCompatible(
                        Assert.asDefined(row.fields.get(fieldName)),
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

async function externalInvokeRequest(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<ExternalType.ExternalInvocationTypeRequest | undefined> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        externalInvokeRequest.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    const identifier: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (identifier === undefined) {
        trace.exit();

        return undefined;
    }

    const triedDereferencedIdentifier: PQP.Result<
        ReadonlyArray<TDereferencedIdentifier>,
        PQP.CommonError.CommonError
    > = await tryBuildDereferencedIdentifierPath(
        InspectTypeStateUtils.toInspectionSettings(state, trace),
        state.nodeIdMapCollection,
        identifier,
        state.scopeById,
    );

    if (ResultUtils.isError(triedDereferencedIdentifier) || triedDereferencedIdentifier.value === undefined) {
        return undefined;
    }

    const endOfPath: TDereferencedIdentifier = Assert.asDefined(
        triedDereferencedIdentifier.value[triedDereferencedIdentifier.value.length - 1],
    );

    if (endOfPath.kind !== DereferencedIdentifierKind.External) {
        return undefined;
    }

    const types: Type.TPowerQueryType[] = [];

    for (const argument of NodeIdMapIterator.iterInvokeExpression(
        state.nodeIdMapCollection,
        XorNodeUtils.assertAsNodeKind<Ast.InvokeExpression>(xorNode, Ast.NodeKind.InvokeExpression),
    )) {
        // eslint-disable-next-line no-await-in-loop
        types.push(await inspectXor(state, argument, trace.id));
    }

    const result: ExternalType.ExternalInvocationTypeRequest = ExternalTypeUtils.invocationTypeRequest(
        endOfPath.identifierLiteral,
        types,
    );

    trace.exit();

    return result;
}
