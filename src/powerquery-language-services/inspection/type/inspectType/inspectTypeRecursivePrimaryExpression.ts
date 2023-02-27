// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";

export async function inspectTypeRecursivePrimaryExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeRecursivePrimaryExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RecursivePrimaryExpression>(xorNode, Ast.NodeKind.RecursivePrimaryExpression);

    const head: TXorNode | undefined = NodeIdMapUtils.nthChild(state.nodeIdMapCollection, xorNode.node.id, 0);

    if (head === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const headType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 0, trace.id);

    if (headType.kind === Type.TypeKind.None || headType.kind === Type.TypeKind.Unknown) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(headType) });

        return headType;
    }

    const arrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.nthChildChecked<Ast.TArrayWrapper>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        Ast.NodeKind.ArrayWrapper,
    );

    if (arrayWrapper === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const expressions: ReadonlyArray<TXorNode> | undefined = NodeIdMapIterator.assertIterChildrenXor(
        state.nodeIdMapCollection,
        arrayWrapper.node.id,
    );

    if (expressions === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    let leftType: Type.TPowerQueryType = headType;

    for (const right of expressions) {
        // eslint-disable-next-line no-await-in-loop
        const rightType: Type.TPowerQueryType = await inspectXor(state, right, trace.id);
        leftType = rightType;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(leftType) });

    return leftType;
}
