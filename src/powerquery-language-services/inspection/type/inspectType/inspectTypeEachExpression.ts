// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export async function inspectTypeEachExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeEachExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.EachExpression>(xorNode, Ast.NodeKind.EachExpression);

    const expressionType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id);

    const result: Type.TPowerQueryType = TypeUtils.definedFunction(
        false,
        [
            {
                isNullable: false,
                isOptional: false,
                type: Type.TypeKind.Any,
                nameLiteral: "_",
            },
        ],
        expressionType,
    );

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}
