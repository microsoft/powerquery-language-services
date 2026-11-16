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

import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

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

    const head: TXorNode | undefined = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, xorNode.node.id, 0);

    if (head === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const arrayWrapper: XorNode<Ast.TArrayWrapper> | undefined = NodeIdMapUtils.nthChildXorChecked<Ast.TArrayWrapper>(
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

    // Item access can select a lazy list item without inspecting the entire head collection.
    const firstNonItemAccessIndex: number = expressions.findIndex(
        (expression: TXorNode) => expression.node.kind !== Ast.NodeKind.ItemAccessExpression,
    );

    const numItemAccesses: number = firstNonItemAccessIndex === -1 ? expressions.length : firstNonItemAccessIndex;
    const numInitialItemAccesses: number = state.typeStrategy === TypeStrategy.Extended ? numItemAccesses : 0;

    let leftType: Type.TPowerQueryType = await inspectXor(
        state,
        numInitialItemAccesses ? expressions[numInitialItemAccesses - 1] : head,
        trace.id,
    );

    if (
        numInitialItemAccesses === 0 &&
        (leftType.kind === Type.TypeKind.None || leftType.kind === Type.TypeKind.Unknown)
    ) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(leftType) });

        return leftType;
    }

    for (const right of expressions.slice(numInitialItemAccesses)) {
        // eslint-disable-next-line no-await-in-loop
        const rightType: Type.TPowerQueryType = await inspectXor(state, right, trace.id);
        leftType = rightType;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(leftType) });

    return leftType;
}
