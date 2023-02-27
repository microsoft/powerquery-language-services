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
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeErrorHandlingExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TErrorHandlingExpression>(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    // Grabs Ast.ErrorHandlingExpression.handler
    const handler: XorNode<Ast.CatchExpression | Ast.OtherwiseExpression> | undefined = NodeIdMapUtils.nthChildChecked<
        Ast.CatchExpression | Ast.OtherwiseExpression
    >(state.nodeIdMapCollection, xorNode.node.id, 2, [Ast.NodeKind.CatchExpression, Ast.NodeKind.OtherwiseExpression]);

    let errorHandlerResult: Type.TPowerQueryType;

    // No handler exists, i.e. `try 0`
    if (handler === undefined) {
        errorHandlerResult = Type.RecordInstance;
    }
    // If it's a catch handler, i.e. `try 1/0 catch () => "div by 0"`
    else if (handler.node.kind === Ast.NodeKind.CatchExpression) {
        // We care about the evaluation of the function,
        // and as typing isn't allowed on a catch expression it requires an inspection on the function's body
        const fnExpression: XorNode<Ast.FunctionExpression> | undefined =
            NodeIdMapUtils.nthChildChecked<Ast.FunctionExpression>(state.nodeIdMapCollection, handler.node.id, 1, [
                Ast.NodeKind.FunctionExpression,
            ]);

        // If there's no function expression, i.e. `try 1/0 catch`
        if (fnExpression === undefined) {
            errorHandlerResult = Type.UnknownInstance;
        }
        // Else examine Ast.FunctionExpression.expression
        else {
            errorHandlerResult = await inspectTypeFromChildAttributeIndex(state, fnExpression, 3, trace.id);
        }
    }
    // Much easier here, simply return the paired expression.
    else if (handler.node.kind === Ast.NodeKind.OtherwiseExpression) {
        errorHandlerResult = await inspectTypeFromChildAttributeIndex(state, handler, 1, trace.id);
    } else {
        throw new PQP.CommonError.InvariantError(`should never be reached`);
    }

    const result: Type.TPowerQueryType = TypeUtils.anyUnion(
        [await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id), errorHandlerResult],
        state.traceManager,
        trace.id,
    );

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}
