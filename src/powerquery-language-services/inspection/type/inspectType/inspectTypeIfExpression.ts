// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export function inspectTypeIfExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeIfExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );
    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.IfExpression>(xorNode, Ast.NodeKind.IfExpression);

    const conditionType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);
    let result: Type.TPowerQueryType;

    if (conditionType.kind === Type.TypeKind.Unknown) {
        result = Type.UnknownInstance;
    }
    // Any is allowed so long as AnyUnion only contains Any or Logical.
    else if (conditionType.kind === Type.TypeKind.Any) {
        if (
            conditionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
            !allForAnyUnion(
                conditionType,
                (type: Type.TPowerQueryType) => type.kind === Type.TypeKind.Logical || type.kind === Type.TypeKind.Any,
            )
        ) {
            result = Type.NoneInstance;
        } else {
            result = createAnyUnion(state, xorNode);
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        result = Type.NoneInstance;
    } else {
        result = createAnyUnion(state, xorNode);
    }
    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

function createAnyUnion(state: InspectTypeState, xorNode: XorNode<Ast.IfExpression>): Type.TPowerQueryType {
    const trueExprType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 5);

    return TypeUtils.createAnyUnion([trueExprType, falseExprType]);
}
