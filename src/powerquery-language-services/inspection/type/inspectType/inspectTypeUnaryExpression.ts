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
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeUnaryExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TUnaryExpression>(xorNode, Ast.NodeKind.UnaryExpression);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const unaryOperatorWrapper: XorNode<Ast.TArrayWrapper> | undefined =
        NodeIdMapUtils.nthChildChecked<Ast.TArrayWrapper>(
            nodeIdMapCollection,
            xorNode.node.id,
            0,
            Ast.NodeKind.ArrayWrapper,
        );

    if (unaryOperatorWrapper === undefined) {
        trace.exit({ [TraceConstant.Result]: Type.UnknownInstance });

        return Type.UnknownInstance;
    }

    let result: Type.TPowerQueryType;
    const expression: TXorNode | undefined = NodeIdMapUtils.nthChild(nodeIdMapCollection, xorNode.node.id, 1);

    if (expression === undefined) {
        result = Type.UnknownInstance;
    } else {
        const expressionType: Type.TPowerQueryType = await inspectXor(state, expression, trace.id);

        if (expressionType.kind === Type.TypeKind.Number) {
            result = inspectTypeUnaryNumber(state, expressionType, unaryOperatorWrapper.node.id);
        } else if (TypeUtils.isLogical(expressionType)) {
            result = inspectTypeUnaryLogical(state, expressionType, unaryOperatorWrapper.node.id);
        } else {
            result = Type.NoneInstance;
        }
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

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
            return TypeUtils.numberLiteral(
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
