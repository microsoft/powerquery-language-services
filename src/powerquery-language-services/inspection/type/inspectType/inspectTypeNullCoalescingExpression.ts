// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeNullCoalescingExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeNullCoalescingExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.NullCoalescingExpression>(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const maybeLeftType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 0, trace.id);

    const maybeNullCoalescingOperator: Ast.TConstant | undefined =
        NodeIdMapUtils.maybeUnboxNthChildIfAstChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            1,
            Ast.NodeKind.Constant,
        );

    let result: Type.TPowerQueryType;

    // '??' isn't present, treat it as an Expression.
    if (maybeNullCoalescingOperator === undefined) {
        result = maybeLeftType;
    } else {
        const maybeRightType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(
            state,
            xorNode,
            2,
            trace.id,
        );

        if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
            result = Type.NoneInstance;
        } else {
            result = TypeUtils.createAnyUnion([maybeLeftType, maybeRightType]);
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
