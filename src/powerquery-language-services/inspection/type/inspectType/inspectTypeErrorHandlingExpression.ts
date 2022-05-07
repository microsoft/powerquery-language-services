// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeErrorHandlingExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeErrorHandlingExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.ErrorHandlingExpression>(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    const maybeOtherwiseExpression: XorNode<Ast.OtherwiseExpression> | undefined =
        NodeIdMapUtils.maybeNthChildChecked<Ast.OtherwiseExpression>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            2,
            Ast.NodeKind.OtherwiseExpression,
        );

    const result: Type.TPowerQueryType = TypeUtils.createAnyUnion([
        await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id),
        maybeOtherwiseExpression !== undefined
            ? await inspectXor(state, maybeOtherwiseExpression, trace.id)
            : TypeUtils.createPrimitiveType(false, Type.TypeKind.Record),
    ]);

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
