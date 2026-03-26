// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapUtils,
    TXorNode,
    XorNodeKind,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";

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

    const collectionType: Type.TPowerQueryType = await inspectXor(state, previousSibling, trace.id);

    // Child index 1 is the content (index expression) of the brace-wrapped ItemAccessExpression.
    const indexXorNode: TXorNode | undefined = NodeIdMapUtils.nthChildXor(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
    );

    const indexValue: number | undefined = tryExtractNumericLiteralIndex(indexXorNode);

    const isOptional: boolean =
        NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    let result: Type.TPowerQueryType = getElementType(state, collectionType, indexValue, trace.id);

    if (isOptional) {
        result = { ...result, isNullable: true };
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function getElementType(
    state: InspectTypeState,
    collectionType: Type.TPowerQueryType,
    indexValue: number | undefined,
    correlationId: number,
): Type.TPowerQueryType {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (collectionType.kind) {
        case Type.TypeKind.Any:
            if (collectionType.extendedKind === Type.ExtendedTypeKind.AnyUnion) {
                return getElementTypeFromAnyUnion(state, collectionType, indexValue, correlationId);
            }

            return Type.AnyInstance;

        case Type.TypeKind.List:
            if (collectionType.extendedKind === Type.ExtendedTypeKind.DefinedList) {
                // If we know the exact index and it's in bounds, return the specific element type.
                if (indexValue !== undefined && indexValue >= 0 && indexValue < collectionType.elements.length) {
                    return collectionType.elements[indexValue];
                }

                // Known index but out of bounds — this will error at runtime.
                if (indexValue !== undefined) {
                    return Type.NoneInstance;
                }

                return TypeUtils.anyUnion(collectionType.elements, state.traceManager, correlationId);
            }

            return Type.AnyInstance;

        case Type.TypeKind.Table:
            if (collectionType.extendedKind === Type.ExtendedTypeKind.DefinedTable) {
                return TypeUtils.definedRecord(false, new Map(collectionType.fields.entries()), collectionType.isOpen);
            }

            return Type.RecordInstance;

        default:
            return Type.AnyInstance;
    }
}

function getElementTypeFromAnyUnion(
    state: InspectTypeState,
    anyUnion: Type.AnyUnion,
    indexValue: number | undefined,
    correlationId: number,
): Type.TPowerQueryType {
    const elementTypes: Type.TPowerQueryType[] = [];

    for (const member of anyUnion.unionedTypePairs) {
        const elementType: Type.TPowerQueryType = getElementType(state, member, indexValue, correlationId);
        elementTypes.push(elementType);
    }

    return TypeUtils.anyUnion(elementTypes, state.traceManager, correlationId);
}

function tryExtractNumericLiteralIndex(indexXorNode: TXorNode | undefined): number | undefined {
    if (
        indexXorNode === undefined ||
        indexXorNode.kind !== XorNodeKind.Ast ||
        indexXorNode.node.kind !== Ast.NodeKind.LiteralExpression
    ) {
        return undefined;
    }

    const literalExpression: Ast.LiteralExpression = indexXorNode.node as Ast.LiteralExpression;

    if (literalExpression.literalKind !== Ast.LiteralKind.Numeric) {
        return undefined;
    }

    const parsed: number = Number(literalExpression.literal);

    if (!Number.isInteger(parsed) || parsed < 0) {
        return undefined;
    }

    return parsed;
}
