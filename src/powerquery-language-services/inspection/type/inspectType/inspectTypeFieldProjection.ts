// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { XorNodeUtils } from "../../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldProjection(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.FieldProjection);

    const projectedFieldNames: ReadonlyArray<string> = PQP.Parser.NodeIdMapIterator.iterFieldProjectionNames(
        state.nodeIdMapCollection,
        xorNode,
    );
    const previousSibling: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: PQP.Language.Type.TPowerQueryType = inspectXor(state, previousSibling);
    const isOptional: boolean =
        PQP.Parser.NodeIdMapUtils.maybeUnwrapNthChildIfAstChecked(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            PQP.Language.Ast.NodeKind.Constant,
        ) !== undefined;

    return inspectFieldProjectionHelper(previousSiblingType, projectedFieldNames, isOptional);
}

function inspectFieldProjectionHelper(
    previousSiblingType: PQP.Language.Type.TPowerQueryType,
    projectedFieldNames: ReadonlyArray<string>,
    isOptional: boolean,
): PQP.Language.Type.TPowerQueryType {
    switch (previousSiblingType.kind) {
        case PQP.Language.Type.TypeKind.Any: {
            const projectedFields: PQP.Language.Type.UnorderedFields = new Map(
                projectedFieldNames.map((fieldName: string) => [fieldName, PQP.Language.Type.AnyInstance]),
            );

            return {
                kind: PQP.Language.Type.TypeKind.Any,
                maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.AnyUnion,
                isNullable: previousSiblingType.isNullable,
                unionedTypePairs: [
                    {
                        kind: PQP.Language.Type.TypeKind.Record,
                        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.DefinedRecord,
                        isNullable: previousSiblingType.isNullable,
                        fields: projectedFields,
                        isOpen: false,
                    },
                    {
                        kind: PQP.Language.Type.TypeKind.Table,
                        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.DefinedTable,
                        isNullable: previousSiblingType.isNullable,
                        fields: new PQP.OrderedMap([...projectedFields]),
                        isOpen: false,
                    },
                ],
            };
        }

        case PQP.Language.Type.TypeKind.Record:
        case PQP.Language.Type.TypeKind.Table: {
            // All we know is previousSibling was a Record/Table.
            // Create a DefinedRecord/DefinedTable with the projected fields.
            if (PQP.Language.TypeUtils.isDefinedRecord(previousSiblingType)) {
                return reducedFieldsToKeys(previousSiblingType, projectedFieldNames, isOptional, reducedRecordFields);
            } else if (PQP.Language.TypeUtils.isDefinedTable(previousSiblingType)) {
                return reducedFieldsToKeys(previousSiblingType, projectedFieldNames, isOptional, reducedTableFields);
            } else {
                const newFields: Map<string, PQP.Language.Type.TPowerQueryType> = new Map(
                    projectedFieldNames.map((fieldName: string) => [fieldName, PQP.Language.Type.AnyInstance]),
                );
                return previousSiblingType.kind === PQP.Language.Type.TypeKind.Record
                    ? PQP.Language.TypeUtils.createDefinedRecord(false, newFields, false)
                    : PQP.Language.TypeUtils.createDefinedTable(false, new PQP.OrderedMap([...newFields]), false);
            }
        }

        default:
            return PQP.Language.Type.NoneInstance;
    }
}

// Returns a subset of `current` using `keys`.
// If a mismatch is found it either returns Null if isOptional, else None.
function reducedFieldsToKeys<T extends PQP.Language.Type.DefinedRecord | PQP.Language.Type.DefinedTable>(
    current: T,
    keys: ReadonlyArray<string>,
    isOptional: boolean,
    createFieldsFn: (
        current: T,
        keys: ReadonlyArray<string>,
    ) => T extends PQP.Language.Type.DefinedRecord
        ? PQP.Language.Type.UnorderedFields
        : PQP.Language.Type.OrderedFields,
): T | PQP.Language.Type.None | PQP.Language.Type.Null {
    const currentFieldNames: ReadonlyArray<string> = [...current.fields.keys()];

    if (!current.isOpen && !PQP.ArrayUtils.isSubset(currentFieldNames, keys)) {
        return isOptional ? PQP.Language.Type.NullInstance : PQP.Language.Type.NoneInstance;
    }

    return {
        ...current,
        fields: createFieldsFn(current, keys),
        isOpen: false,
    };
}

function reducedRecordFields(
    current: PQP.Language.Type.DefinedRecord,
    keys: ReadonlyArray<string>,
): PQP.Language.Type.UnorderedFields {
    return PQP.MapUtils.pick(current.fields, keys);
}

function reducedTableFields(
    current: PQP.Language.Type.DefinedTable,
    keys: ReadonlyArray<string>,
): PQP.Language.Type.OrderedFields {
    return new PQP.OrderedMap([...PQP.MapUtils.pick(current.fields, keys).entries()]);
}
