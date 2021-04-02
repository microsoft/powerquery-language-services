// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldProjection(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.FieldProjection);

    const projectedFieldNames: ReadonlyArray<string> = PQP.Parser.NodeIdMapIterator.iterFieldProjectionNames(
        state.nodeIdMapCollection,
        xorNode,
    );
    const previousSibling: PQP.Parser.TXorNode = PQP.Parser.NodeIdMapUtils.assertGetRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: PQP.Language.Type.PowerQueryType = inspectXor(state, previousSibling);
    const isOptional: boolean =
        PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 3, [
            PQP.Language.Ast.NodeKind.Constant,
        ]) !== undefined;

    return inspectFieldProjectionHelper(previousSiblingType, projectedFieldNames, isOptional);
}

function inspectFieldProjectionHelper(
    previousSiblingType: PQP.Language.Type.PowerQueryType,
    projectedFieldNames: ReadonlyArray<string>,
    isOptional: boolean,
): PQP.Language.Type.PowerQueryType {
    switch (previousSiblingType.kind) {
        case PQP.Language.Type.TypeKind.Any: {
            const newFields: Map<string, PQP.Language.Type.Any> = new Map(
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
                        fields: newFields,
                        isOpen: false,
                    },
                    {
                        kind: PQP.Language.Type.TypeKind.Table,
                        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.DefinedTable,
                        isNullable: previousSiblingType.isNullable,
                        fields: newFields,
                        isOpen: false,
                    },
                ],
            };
        }

        case PQP.Language.Type.TypeKind.Record:
        case PQP.Language.Type.TypeKind.Table: {
            // All we know is previousSibling was a Record/Table.
            // Create a DefinedRecord/DefinedTable with the projected fields.
            if (previousSiblingType.maybeExtendedKind === undefined) {
                const newFields: Map<string, PQP.Language.Type.Any> = new Map(
                    projectedFieldNames.map((fieldName: string) => [fieldName, PQP.Language.Type.AnyInstance]),
                );
                return previousSiblingType.kind === PQP.Language.Type.TypeKind.Record
                    ? PQP.Language.TypeUtils.createDefinedRecord(false, newFields, false)
                    : PQP.Language.TypeUtils.createDefinedTable(false, newFields, false);
            } else {
                return reducedFieldsToKeys(previousSiblingType, projectedFieldNames, isOptional);
            }
        }

        default:
            return PQP.Language.Type.NoneInstance;
    }
}

// Returns a subset of `current` using `keys`.
// If a mismatch is found it either returns Null if isOptional, else None.
function reducedFieldsToKeys(
    current: PQP.Language.Type.DefinedRecord | PQP.Language.Type.DefinedTable,
    keys: ReadonlyArray<string>,
    isOptional: boolean,
): PQP.Language.Type.DefinedRecord | PQP.Language.Type.DefinedTable | PQP.Language.Type.None | PQP.Language.Type.Null {
    const currentFields: Map<string, PQP.Language.Type.PowerQueryType> = current.fields;
    const currentFieldNames: ReadonlyArray<string> = [...current.fields.keys()];

    if (current.isOpen === false && PQP.ArrayUtils.isSubset(currentFieldNames, keys) === false) {
        return isOptional ? PQP.Language.Type.NullInstance : PQP.Language.Type.NoneInstance;
    }

    return {
        ...current,
        fields: PQP.MapUtils.pick(currentFields, keys),
        isOpen: false,
    };
}
