// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    type TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../../..";
import { inspectFieldType } from "./common";
import { type InspectTypeState } from "../inspectTypeState";

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
            const projectedFields: Type.UnorderedFields = new Map(
                projectedFieldLiterals.map((fieldName: string) => [fieldName, Type.AnyInstance]),
            );

            result = {
                kind: Type.TypeKind.Any,
                extendedKind: Type.ExtendedTypeKind.AnyUnion,
                isNullable: fieldType.isNullable,
                unionedTypePairs: [
                    {
                        kind: Type.TypeKind.Record,
                        extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                        isNullable: fieldType.isNullable,
                        fields: projectedFields,
                        isOpen: false,
                    },
                    {
                        kind: Type.TypeKind.Table,
                        extendedKind: Type.ExtendedTypeKind.DefinedTable,
                        isNullable: fieldType.isNullable,
                        fields: new PQP.OrderedMap([...projectedFields]),
                        isOpen: false,
                    },
                ],
            };

            break;
        }

        case Type.TypeKind.Record:
        case Type.TypeKind.Table:
            result = inspectRecordOrTableProjection(fieldType, projectedFieldLiterals, isOptional);
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

function inspectRecordOrTableProjection(
    fieldType: Type.TRecord | Type.TTable,
    projectedFieldLiterals: ReadonlyArray<string>,
    isOptional: boolean,
): Type.TPowerQueryType {
    // All we know is fieldType was a Record/Table.
    // Create a DefinedRecord/DefinedTable with the projected fields.
    if (TypeUtils.isDefinedRecord(fieldType)) {
        return reducedFieldsToKeys(fieldType, projectedFieldLiterals, isOptional, reducedRecordFields);
    } else if (TypeUtils.isDefinedTable(fieldType)) {
        return reducedFieldsToKeys(fieldType, projectedFieldLiterals, isOptional, reducedTableFields);
    } else {
        const newFields: Map<string, Type.TPowerQueryType> = new Map(
            projectedFieldLiterals.map((fieldName: string) => [fieldName, Type.AnyInstance]),
        );

        return fieldType.kind === Type.TypeKind.Record
            ? TypeUtils.definedRecord(false, newFields, false)
            : TypeUtils.definedTable(false, new PQP.OrderedMap([...newFields]), false);
    }
}

// Returns a subset of `current` using `keys`.
// If a mismatch is found it either returns Null if isOptional, else None.
function reducedFieldsToKeys<T extends Type.DefinedRecord | Type.DefinedTable>(
    current: T,
    keys: ReadonlyArray<string>,
    isOptional: boolean,
    fieldsFactory: (
        current: T,
        keys: ReadonlyArray<string>,
    ) => T extends Type.DefinedRecord ? Type.UnorderedFields : Type.OrderedFields,
): T | Type.None | Type.Null {
    const currentFieldNames: ReadonlyArray<string> = [...current.fields.keys()];

    if (!current.isOpen && !PQP.ArrayUtils.isSubset(currentFieldNames, keys)) {
        return isOptional ? Type.NullInstance : Type.NoneInstance;
    }

    return {
        ...current,
        fields: fieldsFactory(current, keys),
        isOpen: false,
    };
}

function reducedRecordFields(current: Type.DefinedRecord, keys: ReadonlyArray<string>): Type.UnorderedFields {
    return PQP.MapUtils.pick(current.fields, keys);
}

function reducedTableFields(current: Type.DefinedTable, keys: ReadonlyArray<string>): Type.OrderedFields {
    return new PQP.OrderedMap([...PQP.MapUtils.pick(current.fields, keys).entries()]);
}
