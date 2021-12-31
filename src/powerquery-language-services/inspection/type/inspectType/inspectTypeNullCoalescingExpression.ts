// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export function inspectTypeNullCoalescingExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeNullCoalescingExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.NullCoalescingExpression>(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const maybeLeftType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    const maybeNullCoalescingOperator: Ast.TConstant | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
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
        const maybeRightType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
        if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
            result = Type.NoneInstance;
        } else {
            result = TypeUtils.createAnyUnion([maybeLeftType, maybeRightType]);
        }
    }
    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
