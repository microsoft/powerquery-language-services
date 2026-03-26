// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
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

    const isOptional: boolean =
        NodeIdMapUtils.nthChildAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            3,
            Ast.NodeKind.Constant,
        ) !== undefined;

    let result: Type.TPowerQueryType = getElementType(state, collectionType, trace.id);

    if (isOptional) {
        result = { ...result, isNullable: true };
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function getElementType(
    state: InspectTypeState,
    collectionType: Type.TPowerQueryType,
    correlationId: number,
): Type.TPowerQueryType {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (collectionType.kind) {
        case Type.TypeKind.Any:
            if (collectionType.extendedKind === Type.ExtendedTypeKind.AnyUnion) {
                return getElementTypeFromAnyUnion(state, collectionType, correlationId);
            }

            return Type.AnyInstance;

        case Type.TypeKind.List:
            if (collectionType.extendedKind === Type.ExtendedTypeKind.DefinedList) {
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
    correlationId: number,
): Type.TPowerQueryType {
    const elementTypes: Type.TPowerQueryType[] = [];

    for (const member of anyUnion.unionedTypePairs) {
        const elementType: Type.TPowerQueryType = getElementType(state, member, correlationId);
        elementTypes.push(elementType);
    }

    return TypeUtils.anyUnion(elementTypes, state.traceManager, correlationId);
}
