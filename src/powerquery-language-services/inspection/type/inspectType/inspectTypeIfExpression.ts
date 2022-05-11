// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { InspectionTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeIfExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeIfExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.IfExpression>(xorNode, Ast.NodeKind.IfExpression);

    const conditionType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id);
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
            result = await createAnyUnion(state, xorNode, trace.id);
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        result = Type.NoneInstance;
    } else {
        result = await createAnyUnion(state, xorNode, trace.id);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

async function createAnyUnion(
    state: InspectTypeState,
    xorNode: XorNode<Ast.IfExpression>,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        createAnyUnion.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    const trueExprType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 3, trace.id);
    const falseExprType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 5, trace.id);
    const result: Type.TPowerQueryType = TypeUtils.createAnyUnion([trueExprType, falseExprType]);
    trace.exit();

    return result;
}
