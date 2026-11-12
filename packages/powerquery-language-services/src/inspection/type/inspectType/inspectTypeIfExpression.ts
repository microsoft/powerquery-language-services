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

import { allForAnyUnion, inspectTypeFromChildAttributeIndex } from "./common";
import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from "./inspectTypeState";

export async function inspectTypeIfExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeIfExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.IfExpression>(xorNode, Ast.NodeKind.IfExpression);

    const conditionType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 1, trace.id);
    let result: Type.TPowerQueryType;

    if (conditionType.kind === Type.TypeKind.Unknown) {
        result = Type.UnknownInstance;
    }
    // Any is allowed so long as AnyUnion only contains Any or Logical.
    else if (conditionType.kind === Type.TypeKind.Any) {
        if (
            conditionType.extendedKind === Type.ExtendedTypeKind.AnyUnion &&
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
        const condition: boolean | undefined = literalCondition(state, xorNode);

        if (condition === undefined) {
            result = await createAnyUnion(state, xorNode, trace.id);
            trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

            return result;
        }

        if (condition) {
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 3, trace.id);
        } else {
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 5, trace.id);
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function literalCondition(state: InspectTypeState, xorNode: XorNode<Ast.IfExpression>): boolean | undefined {
    let condition: TXorNode | undefined = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, xorNode.node.id, 1);

    while (condition?.node.kind === Ast.NodeKind.ParenthesizedExpression) {
        state.cancellationToken?.throwIfCancelled();
        condition = NodeIdMapUtils.nthChildXor(state.nodeIdMapCollection, condition.node.id, 1);
    }

    if (
        condition !== undefined &&
        XorNodeUtils.isAstChecked<Ast.LiteralExpression>(condition, Ast.NodeKind.LiteralExpression) &&
        condition.node.literalKind === Ast.LiteralKind.Logical
    ) {
        return condition.node.literal === "true";
    }

    return undefined;
}

async function createAnyUnion(
    state: InspectTypeState,
    xorNode: XorNode<Ast.IfExpression>,
    correlationId: number,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        createAnyUnion.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    const trueExprType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 3, trace.id);
    const falseExprType: Type.TPowerQueryType = await inspectTypeFromChildAttributeIndex(state, xorNode, 5, trace.id);

    const result: Type.TPowerQueryType = TypeUtils.anyUnion(
        [trueExprType, falseExprType],
        state.traceManager,
        trace.id,
    );

    trace.exit();

    return result;
}
