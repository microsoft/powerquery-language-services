// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";
import {
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";

export function inspectTypeRecursivePrimaryExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeRecursivePrimaryExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.RecursivePrimaryExpression>(xorNode, Ast.NodeKind.RecursivePrimaryExpression);

    const maybeHead: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(state.nodeIdMapCollection, xorNode.node.id, 0);
    if (maybeHead === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const headType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    if (headType.kind === Type.TypeKind.None || headType.kind === Type.TypeKind.Unknown) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(headType) });

        return headType;
    }

    const maybeArrayWrapper: XorNode<Ast.TArrayWrapper> | undefined =
        NodeIdMapUtils.maybeNthChildChecked<Ast.TArrayWrapper>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            1,
            Ast.NodeKind.ArrayWrapper,
        );
    if (maybeArrayWrapper === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    const maybeExpressions: ReadonlyArray<TXorNode> | undefined = NodeIdMapIterator.assertIterChildrenXor(
        state.nodeIdMapCollection,
        maybeArrayWrapper.node.id,
    );
    if (maybeExpressions === undefined) {
        trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(Type.UnknownInstance) });

        return Type.UnknownInstance;
    }

    let leftType: Type.TPowerQueryType = headType;
    for (const right of maybeExpressions) {
        const rightType: Type.TPowerQueryType = inspectXor(state, right);
        leftType = rightType;
    }
    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(leftType) });

    return leftType;
}
