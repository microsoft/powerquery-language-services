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
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TErrorHandlingExpression>(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    // Grabs Ast.ErrorHandlingExpression.maybeHandler
    const maybeHandler: XorNode<Ast.CatchExpression | Ast.OtherwiseExpression> | undefined =
        NodeIdMapUtils.nthChildChecked<Ast.CatchExpression | Ast.OtherwiseExpression>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            2,
            [Ast.NodeKind.CatchExpression, Ast.NodeKind.OtherwiseExpression],
        );

    let errorHandlerResult: Type.TPowerQueryType;

    // No handler exists, i.e. `try 0`
    if (maybeHandler === undefined) {
        errorHandlerResult = Type.RecordInstance;
    }
    // If it's a catch handler, i.e. `try 1/0 catch () => "div by 0"`
    else if (maybeHandler.node.kind === Ast.NodeKind.CatchExpression) {
        // We care about the evaluation of the function,
        // and as typing isn't allowed on a catch expression it requires an inspection on the function's body
        const maybeFnExpression: XorNode<Ast.FunctionExpression> | undefined =
            NodeIdMapUtils.nthChildChecked<Ast.FunctionExpression>(state.nodeIdMapCollection, maybeHandler.node.id, 1, [
                Ast.NodeKind.FunctionExpression,
            ]);

        // If there's no function expression, i.e. `try 1/0 catch`
        if (maybeFnExpression === undefined) {
            errorHandlerResult = Type.UnknownInstance;
        }
        // Else examine Ast.FunctionExpression.expression
        else {
            errorHandlerResult = await inspectTypeFromChildAttributeIndex(state, maybeFnExpression, 3, trace.id);
        }
    }
    // Much easier here, simply return the paired expression.
    else if (maybeHandler.node.kind === Ast.NodeKind.OtherwiseExpression) {
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
