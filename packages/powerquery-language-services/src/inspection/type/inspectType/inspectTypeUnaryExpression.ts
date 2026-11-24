// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils, Constant, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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
import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";

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
        NodeIdMapUtils.nthChildXorChecked<Ast.TArrayWrapper>(
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
    const expression: TXorNode | undefined = NodeIdMapUtils.nthChildXor(nodeIdMapCollection, xorNode.node.id, 1);

    if (expression === undefined) {
        result = Type.UnknownInstance;
    } else {
        const expressionType: Type.TPowerQueryType = await inspectXor(state, expression, trace.id);

        const operators: ReadonlyArray<Constant.UnaryOperator> = Assert.asDefined(
            NodeIdMapIterator.iterChildrenAst(nodeIdMapCollection, unaryOperatorWrapper.node.id),
        ).map((node: Ast.TNode) => {
            AstUtils.assertIsNodeKind<Ast.IConstant<Constant.UnaryOperator>>(node, Ast.NodeKind.Constant);

            return node.constantKind;
        });

        result = inspectUnaryOperation(state, expressionType, operators, trace.id);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}

function inspectUnaryOperation(
    state: InspectTypeState,
    expressionType: Type.TPowerQueryType,
    operators: ReadonlyArray<Constant.UnaryOperator>,
    correlationId: number,
): Type.TPowerQueryType {
    if (TypeUtils.isAnyUnion(expressionType)) {
        const members: ReadonlyArray<Type.TPowerQueryType> = expressionType.isNullable
            ? [...expressionType.unionedTypePairs, Type.NullInstance]
            : expressionType.unionedTypePairs;

        return TypeUtils.anyUnion(
            members.map((member: Type.TPowerQueryType) =>
                inspectUnaryOperation(state, member, operators, correlationId),
            ),
            state.traceManager,
            correlationId,
        );
    } else if (expressionType.kind === Type.TypeKind.Null) {
        return Type.NullInstance;
    }

    let result: Type.TPowerQueryType = Type.NoneInstance;

    if (expressionType.kind === Type.TypeKind.Number || expressionType.kind === Type.TypeKind.Duration) {
        result = inspectTypeUnaryNumberOrDuration(expressionType, operators);
    } else if (TypeUtils.isLogical(expressionType)) {
        result = inspectTypeUnaryLogical(expressionType, operators);
    }

    // An invalid non-null operand raises an error, but every unary operator propagates null.
    return result.kind === Type.TypeKind.None && expressionType.isNullable
        ? TypeUtils.anyUnion([Type.NoneInstance, Type.NullInstance], state.traceManager, correlationId)
        : result;
}

function inspectTypeUnaryNumberOrDuration(
    expressionType: Type.TNumber | Type.Duration,
    operators: ReadonlyArray<Constant.UnaryOperator>,
): Type.TNumber | Type.Duration | Type.None {
    for (const operator of operators) {
        if (operator !== Constant.UnaryOperator.Positive && operator !== Constant.UnaryOperator.Negative) {
            return Type.NoneInstance;
        }
    }

    if (TypeUtils.isNumberLiteral(expressionType)) {
        return TypeUtils.numberLiteral(expressionType.isNullable, [...operators, expressionType.literal].join(""));
    }

    return expressionType;
}

function inspectTypeUnaryLogical(
    expressionType: Type.TLogical,
    operators: ReadonlyArray<Constant.UnaryOperator>,
): Type.TLogical | Type.None {
    for (const operator of operators) {
        if (operator !== Constant.UnaryOperator.Not) {
            return Type.NoneInstance;
        }
    }

    return TypeUtils.isLogicalLiteral(expressionType)
        ? TypeUtils.logicalLiteral(
              expressionType.isNullable,
              operators.length % 2 === 0 ? expressionType.normalizedLiteral : !expressionType.normalizedLiteral,
          )
        : expressionType;
}
