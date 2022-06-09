// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export async function inspectTypeErrorHandlingExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeErrorHandlingExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TErrorHandlingExpression>(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    // Grabs Ast.ErrorHandlingExpression.maybeHandler
    const maybeHandler: XorNode<Ast.CatchExpression | Ast.OtherwiseExpression> | undefined =
        NodeIdMapUtils.maybeNthChildChecked<Ast.CatchExpression | Ast.OtherwiseExpression>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            2,
            [Ast.NodeKind.CatchExpression, Ast.NodeKind.OtherwiseExpression],
        );

    let errorHandlerResult: Type.TPowerQueryType;

    if (maybeHandler === undefined) {
        errorHandlerResult = Type.RecordInstance;
    } else if (maybeHandler.node.kind === Ast.NodeKind.CatchExpression) {
        const maybeFnExpression: XorNode<Ast.FunctionExpression> | undefined =
            NodeIdMapUtils.maybeNthChildChecked<Ast.FunctionExpression>(
                state.nodeIdMapCollection,
                maybeHandler.node.id,
                1,
                [Ast.NodeKind.FunctionExpression],
            );

        if (maybeFnExpression !== undefined) {
            errorHandlerResult = await inspectTypeFromChildAttributeIndex(state, maybeFnExpression, 3, trace.id);
        } else {
            errorHandlerResult = Type.UnknownInstance;
        }
    } else if (maybeHandler.node.kind === Ast.NodeKind.OtherwiseExpression) {
        errorHandlerResult = await inspectTypeFromChildAttributeIndex(state, maybeHandler, 1, trace.id);
    } else {
        throw new PQP.CommonError.InvariantError(`should never be reached`);
    }

    const result: Type.TPowerQueryType = TypeUtils.createAnyUnion(
        [await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id), errorHandlerResult],
        state.traceManager,
        trace.id,
    );

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
