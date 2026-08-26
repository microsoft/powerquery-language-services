// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../../..";
import { inspectFieldType } from "./common";
import { InspectTypeState } from "../inspectTypeState";

export async function inspectTypeFieldProjection(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeFieldProjection.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldProjection>(xorNode, Ast.NodeKind.FieldProjection);

    const projectedFieldLiterals: ReadonlyArray<string> = NodeIdMapIterator.iterFieldProjectionFieldLiterals(
        state.nodeIdMapCollection,
        xorNode,
    );

    const fieldType: Type.TPowerQueryType = await inspectFieldType(state, xorNode, trace.id);

    const isOptional: boolean =
        NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    let result: Type.TPowerQueryType;

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (fieldType.kind) {
        case Type.TypeKind.Any: {
            const projectedFields: Type.UnorderedFields = anyFields(projectedFieldLiterals);

            result = {
                kind: Type.TypeKind.Any,
                extendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: fieldType.isNullable,
                unionedTypePairs: [
                    TypeUtils.definedRecord(fieldType.isNullable, projectedFields, false),
                    TypeUtils.definedTable(
                        fieldType.isNullable,
                        projectedTableFields(undefined, projectedFieldLiterals),
                    ),
                ],
            };

            break;
        }

        case Type.TypeKind.Record:
            result = inspectRecordProjection(fieldType, projectedFieldLiterals, isOptional);
            break;

        case Type.TypeKind.Table:
            result = inspectTableProjection(fieldType, projectedFieldLiterals, isOptional);
            break;

        case Type.TypeKind.Unknown:
            result = Type.UnknownInstance;
            break;

        default:
            result = Type.NoneInstance;
            break;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function inspectRecordProjection(
    fieldType: Type.TRecord,
    projectedFieldLiterals: ReadonlyArray<string>,
    isOptional: boolean,
): Type.TPowerQueryType {
    // All we know is fieldType was a Record.
    // Create a DefinedRecord with the projected fields.
    if (!TypeUtils.isDefinedRecord(fieldType)) {
        return TypeUtils.definedRecord(false, anyFields(projectedFieldLiterals), false);
    }

    // Returns a subset of fieldType using projectedFieldLiterals.
    // If a mismatch is found it either returns Null if isOptional, else None.
    if (!fieldType.isOpen && !PQP.ArrayUtils.isSubset([...fieldType.fields.keys()], projectedFieldLiterals)) {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }

    return {
        ...fieldType,
        fields: PQP.MapUtils.pick(fieldType.fields, projectedFieldLiterals),
        isOpen: false,
    };
}

function inspectTableProjection(
    fieldType: Type.TTable,
    projectedFieldLiterals: ReadonlyArray<string>,
    isOptional: boolean,
): Type.TPowerQueryType {
    // All we know is fieldType was a Table.
    // Create a DefinedTable with the projected fields.
    if (!TypeUtils.isDefinedTable(fieldType)) {
        return TypeUtils.definedTable(fieldType.isNullable, projectedTableFields(undefined, projectedFieldLiterals));
    }

    const hasUndeclaredField: boolean = projectedFieldLiterals.some(
        (fieldName: string) => !fieldType.fields.has(fieldName),
    );

    if (hasUndeclaredField && !fieldType.isOpen) {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }

    const fields: Type.OrderedFields = projectedTableFields(fieldType.fields, projectedFieldLiterals);

    const rows: ReadonlyArray<Type.UnorderedFields> | undefined = hasUndeclaredField
        ? undefined
        : fieldType.rows?.map((row: Type.UnorderedFields) => PQP.MapUtils.pick(row, projectedFieldLiterals));

    return TypeUtils.definedTable(fieldType.isNullable, fields, rows);
}

function anyFields(fieldNames: ReadonlyArray<string>): Type.UnorderedFields {
    return new Map(fieldNames.map((fieldName: string) => [fieldName, Type.AnyInstance]));
}

function projectedTableFields(
    sourceFields: Type.OrderedFields | undefined,
    fieldNames: ReadonlyArray<string>,
): Type.OrderedFields {
    return new PQP.OrderedMap(
        fieldNames.map((fieldName: string) => [fieldName, sourceFields?.get(fieldName) ?? Type.AnyInstance]),
    );
}
