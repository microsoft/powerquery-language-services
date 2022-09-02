// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";

export async function inspectTypeUnaryExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeUnaryExpression.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TUnaryExpression>(xorNode, Ast.NodeKind.UnaryExpression);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const maybeUnaryOperatorWrapper: XorNode<Ast.TArrayWrapper> | undefined =
        NodeIdMapUtils.nthChildChecked<Ast.TArrayWrapper>(
            nodeIdMapCollection,
            xorNode.node.id,
            0,
            Ast.NodeKind.ArrayWrapper,
        );

    if (maybeUnaryOperatorWrapper === undefined) {
        trace.exit({ [TraceConstant.Result]: Type.UnknownInstance });

        return Type.UnknownInstance;
    }

    const unaryOperatorWrapper: TXorNode | undefined = maybeUnaryOperatorWrapper;

    let result: Type.TPowerQueryType;
    const maybeExpression: TXorNode | undefined = NodeIdMapUtils.nthChild(nodeIdMapCollection, xorNode.node.id, 1);

    if (maybeExpression === undefined) {
        result = Type.UnknownInstance;
    } else {
        const expression: TXorNode = maybeExpression;
        const expressionType: Type.TPowerQueryType = await inspectXor(state, expression, trace.id);

        if (expressionType.kind === Type.TypeKind.Number) {
            result = inspectTypeUnaryNumber(state, expressionType, unaryOperatorWrapper.node.id);
        } else if (TypeUtils.isLogical(expressionType)) {
            result = inspectTypeUnaryLogical(state, expressionType, unaryOperatorWrapper.node.id);
        } else {
            result = Type.NoneInstance;
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}

type NumberUnaryNodeOperator = Ast.IConstant<Constant.UnaryOperator.Negative | Constant.UnaryOperator.Positive>;
type LogicalUnaryNodeOperator = Ast.IConstant<Constant.UnaryOperator.Not>;

function inspectTypeUnaryNumber(
    state: InspectTypeState,
    unaryExpressionType: Type.TNumber,
    unaryOperatorWrapperId: number,
): Type.TNumber | Type.None {
    const unaryNodeOperators: ReadonlyArray<NumberUnaryNodeOperator> = Assert.asDefined(
        NodeIdMapIterator.iterChildrenAst(state.nodeIdMapCollection, unaryOperatorWrapperId),
    ) as ReadonlyArray<NumberUnaryNodeOperator>;

    const expectedUnaryOperators: ReadonlyArray<Constant.UnaryOperator> = [
        Constant.UnaryOperator.Positive,
        Constant.UnaryOperator.Negative,
    ];

    const unaryOperators: (Constant.UnaryOperator.Negative | Constant.UnaryOperator.Positive)[] = [];
    let isPositive: boolean = true;

    for (const operator of unaryNodeOperators) {
        if (expectedUnaryOperators.indexOf(operator.constantKind) === -1) {
            return Type.NoneInstance;
        }

        unaryOperators.push(operator.constantKind);

        if (operator.constantKind === Constant.UnaryOperator.Negative) {
            isPositive = !isPositive;
        }
    }

    switch (unaryExpressionType.extendedKind) {
        case Type.ExtendedTypeKind.NumberLiteral:
            return TypeUtils.createNumberLiteral(
                unaryExpressionType.isNullable,
                [...unaryOperators, unaryExpressionType.literal].join(""),
            );

        case undefined:
            return unaryExpressionType;

        default:
            throw Assert.isNever(unaryExpressionType);
    }
}

function inspectTypeUnaryLogical(
    state: InspectTypeState,
    unaryExpressionType: Type.TLogical,
    unaryOperatorWrapperId: number,
): Type.TLogical | Type.None {
    const unaryNodeOperators: ReadonlyArray<LogicalUnaryNodeOperator> = Assert.asDefined(
        NodeIdMapIterator.iterChildrenAst(state.nodeIdMapCollection, unaryOperatorWrapperId),
    ) as ReadonlyArray<LogicalUnaryNodeOperator>;

    for (const operator of unaryNodeOperators) {
        if (operator.constantKind !== Constant.UnaryOperator.Not) {
            return Type.NoneInstance;
        }
    }

    return unaryExpressionType;
}
