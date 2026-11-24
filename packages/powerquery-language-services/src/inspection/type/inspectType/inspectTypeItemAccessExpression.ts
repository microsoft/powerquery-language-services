// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex, inspectXor } from "./common";
import { listIndex, tryGetListItem } from "./inspectTypeListItem";
import { InspectTypeState } from "./inspectTypeState";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeItemAccessExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeItemAccessExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.ItemAccessExpression>(xorNode, Ast.NodeKind.ItemAccessExpression);

    // Verify we're inside a RecursivePrimaryExpression's ArrayWrapper
    // before attempting to grab the previous sibling.
    const parent: TXorNode | undefined = NodeIdMapUtils.parentXor(state.nodeIdMapCollection, xorNode.node.id);

    if (parent === undefined || parent.node.kind !== Ast.NodeKind.ArrayWrapper) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.AnyInstance) });

        return Type.AnyInstance;
    }

    const grandparent: TXorNode | undefined = NodeIdMapUtils.parentXor(state.nodeIdMapCollection, parent.node.id);

    if (grandparent === undefined || grandparent.node.kind !== Ast.NodeKind.RecursivePrimaryExpression) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.AnyInstance) });

        return Type.AnyInstance;
    }

    const previousSibling: TXorNode = NodeIdMapUtils.assertRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    const selector: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id);
    const indexValue: number | undefined = listIndex(selector);

    const isOptional: boolean =
        NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    let result: Type.TPowerQueryType | undefined;

    if (state.typeStrategy === TypeStrategy.Extended && indexValue !== undefined) {
        if (state.computingNodeIds.has(xorNode.node.id)) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.AnyInstance) });

            return Type.AnyInstance;
        }

        state.computingNodeIds.add(xorNode.node.id);

        try {
            const item: TXorNode | Type.TPowerQueryType | null | undefined = await tryGetListItem(
                state,
                previousSibling,
                indexValue,
                trace,
            );

            if (item === null) {
                result = isOptional ? Type.NullInstance : Type.NoneInstance;
            } else if (item !== undefined) {
                // A list expression supplies a node to inspect; a range item already has an inferred type.
                // An exact range value proves the position exists; an Any fallback does not.
                result =
                    "node" in item
                        ? await inspectXor(state, item, trace.id)
                        : possiblyMissing(item, isOptional && item.kind === Type.TypeKind.Any);
            }
        } finally {
            state.computingNodeIds.delete(xorNode.node.id);
        }
    }

    if (result === undefined) {
        const collectionType: Type.TPowerQueryType = await inspectXor(state, previousSibling, trace.id);

        if (collectionType.kind === Type.TypeKind.None || collectionType.kind === Type.TypeKind.Unknown) {
            trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(collectionType) });

            return collectionType;
        }

        result = getElementType(state, collectionType, selector, isOptional, trace.id);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function possiblyMissing(type: Type.TPowerQueryType, isOptional: boolean): Type.TPowerQueryType {
    // An unproven position contributes null only for optional access; required access would raise an error.
    return isOptional && !type.isNullable ? { ...type, isNullable: true } : type;
}

function getElementType(
    state: InspectTypeState,
    collectionType: Type.TPowerQueryType,
    selector: Type.TPowerQueryType,
    isOptional: boolean,
    correlationId: number,
): Type.TPowerQueryType {
    // A union can mix valid and invalid selectors. Keep each outcome rather than treating them all as unknown.
    if (TypeUtils.isAnyUnion(selector)) {
        return TypeUtils.anyUnion(
            selector.unionedTypePairs.map((member: Type.TPowerQueryType) =>
                getElementType(state, collectionType, member, isOptional, correlationId),
            ),
            state.traceManager,
            correlationId,
        );
    }

    const indexValue: number | undefined = listIndex(selector);

    // Unknown selectors may still be valid. A known wrong kind or negative index is invalid even with `?`.
    if (
        (selector.kind !== Type.TypeKind.Any &&
            selector.kind !== Type.TypeKind.Unknown &&
            selector.kind !== Type.TypeKind.Number &&
            selector.kind !== Type.TypeKind.Record) ||
        (TypeUtils.isNumberLiteral(selector) && selector.normalizedLiteral < 0)
    ) {
        return Type.NoneInstance;
    }

    switch (collectionType.kind) {
        case Type.TypeKind.Any:
            // A record selector can succeed for a table alternative and fail for a list alternative.
            if (collectionType.extendedKind === Type.ExtendedTypeKind.AnyUnion) {
                return getElementTypeFromAnyUnion(state, collectionType, selector, isOptional, correlationId);
            }

            return possiblyMissing(Type.AnyInstance, isOptional);

        case Type.TypeKind.List:
            // Records match table rows by field value; lists only support positional access.
            if (selector.kind === Type.TypeKind.Record) {
                return Type.NoneInstance;
            }

            if (collectionType.extendedKind === Type.ExtendedTypeKind.DefinedList) {
                // If we know the exact index and it's in bounds, return the specific element type.
                if (indexValue !== undefined && indexValue >= 0 && indexValue < collectionType.elements.length) {
                    return collectionType.elements[indexValue];
                }

                // Optional access suppresses a missing item, not errors in existing elements.
                if (indexValue !== undefined) {
                    return isOptional ? Type.NullInstance : Type.NoneInstance;
                }

                return possiblyMissing(
                    TypeUtils.anyUnion(collectionType.elements, state.traceManager, correlationId),
                    isOptional,
                );
            }

            return possiblyMissing(Type.AnyInstance, isOptional);

        case Type.TypeKind.Table:
            if (collectionType.extendedKind === Type.ExtendedTypeKind.DefinedTable) {
                if (indexValue !== undefined && collectionType.rows !== undefined) {
                    const row: Type.UnorderedFields | undefined = collectionType.rows[indexValue];

                    if (row === undefined) {
                        return isOptional ? Type.NullInstance : Type.NoneInstance;
                    }

                    return TypeUtils.definedRecord(false, row, false);
                }

                // The schema describes a matching row but does not prove that the requested row exists.
                return TypeUtils.definedRecord(isOptional, collectionType.fields, collectionType.isOpen);
            }

            return possiblyMissing(Type.RecordInstance, isOptional);

        default:
            // Optional access tolerates a missing item, not a value that cannot be indexed.
            return Type.NoneInstance;
    }
}

function getElementTypeFromAnyUnion(
    state: InspectTypeState,
    anyUnion: Type.AnyUnion,
    selector: Type.TPowerQueryType,
    isOptional: boolean,
    correlationId: number,
): Type.TPowerQueryType {
    const elementTypes: Type.TPowerQueryType[] = [];

    for (const member of anyUnion.unionedTypePairs) {
        const elementType: Type.TPowerQueryType = getElementType(state, member, selector, isOptional, correlationId);
        elementTypes.push(elementType);
    }

    return TypeUtils.anyUnion(elementTypes, state.traceManager, correlationId);
}
