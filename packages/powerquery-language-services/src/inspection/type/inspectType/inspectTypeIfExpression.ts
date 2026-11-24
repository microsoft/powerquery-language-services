// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Keyword, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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
    } else if (conditionType.kind === Type.TypeKind.Any) {
        // Neither branch can run if every possible condition is nonlogical.
        if (
            TypeUtils.isAnyUnion(conditionType) &&
            allForAnyUnion(conditionType, (type: Type.TPowerQueryType) => !isLogicalCandidate(type))
        ) {
            result = Type.NoneInstance;
        } else {
            result = await createAnyUnion(state, xorNode, trace.id);

            // A mixed condition can reach a branch or raise an error before choosing one.
            if (TypeUtils.isAnyUnion(conditionType) && !allForAnyUnion(conditionType, isLogicalCandidate)) {
                result = TypeUtils.anyUnion([result, Type.NoneInstance], state.traceManager, trace.id);
            }
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        result = Type.NoneInstance;
    } else {
        const literalCondition: boolean | undefined = isLiteralCondition(state, xorNode);

        if (literalCondition === undefined) {
            result = await createAnyUnion(state, xorNode, trace.id);
        } else if (literalCondition) {
            // Attribute index 3 is the expression after "then".
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 3, trace.id);
        } else {
            // Attribute index 5 is the expression after "else".
            result = await inspectTypeFromChildAttributeIndex(state, xorNode, 5, trace.id);
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function isLogicalCandidate(type: Type.TPowerQueryType): boolean {
    return type.kind === Type.TypeKind.Logical || type.kind === Type.TypeKind.Any;
}

function isLiteralCondition(state: InspectTypeState, xorNode: XorNode<Ast.IfExpression>): boolean | undefined {
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
        return condition.node.literal === Keyword.KeywordKind.True;
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
