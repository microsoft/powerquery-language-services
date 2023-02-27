// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export async function inspectTypeNullCoalescingExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeNullCoalescingExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.NullCoalescingExpression>(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const leftType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 0, trace.id);

    const nullCoalescingOperator: Ast.TConstant | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked<Ast.TConstant>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        Ast.NodeKind.Constant,
    );

    let result: Type.TPowerQueryType;

    // '??' isn't present, treat it as an Expression.
    if (nullCoalescingOperator === undefined) {
        result = leftType;
    } else {
        const rightType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 2, trace.id);

        if (leftType.kind === Type.TypeKind.None || rightType.kind === Type.TypeKind.None) {
            result = Type.NoneInstance;
        } else if (!leftType.isNullable) {
            result = leftType;
        } else {
            result = TypeUtils.anyUnion([leftType, rightType], state.traceManager, trace.id);
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}
