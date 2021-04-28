// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeUnaryExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.UnaryExpression);

    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeUnaryOperatorWrapper:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 0, [
        PQP.Language.Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeUnaryOperatorWrapper === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }
    const unaryOperatorWrapper: PQP.Parser.TXorNode | undefined = maybeUnaryOperatorWrapper;

    const maybeExpression: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeExpression === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }
    const expression: PQP.Parser.TXorNode = maybeExpression;

    const expressionType: PQP.Language.Type.TPowerQueryType = inspectXor(state, expression);
    if (expressionType.kind === PQP.Language.Type.TypeKind.Number) {
        return inspectTypeUnaryNumber(state, expressionType, unaryOperatorWrapper.node.id);
    } else if (PQP.Language.TypeUtils.isLogical(expressionType)) {
        return inspectTypeUnaryLogical(state, expressionType, unaryOperatorWrapper.node.id);
    } else {
        return PQP.Language.Type.NoneInstance;
    }
}

type NumberUnaryNodeOperator = PQP.Language.Ast.IConstant<
    PQP.Language.Constant.UnaryOperatorKind.Negative | PQP.Language.Constant.UnaryOperatorKind.Positive
>;
type LogicalUnaryNodeOperator = PQP.Language.Ast.IConstant<PQP.Language.Constant.UnaryOperatorKind.Not>;

function inspectTypeUnaryNumber<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    unaryExpressionType: PQP.Language.Type.TNumber,
    unaryOperatorWrapperId: number,
): PQP.Language.Type.TNumber | PQP.Language.Type.None {
    const unaryNodeOperators: ReadonlyArray<NumberUnaryNodeOperator> = PQP.Assert.asDefined(
        PQP.Parser.NodeIdMapIterator.maybeIterChildrenAst(state.nodeIdMapCollection, unaryOperatorWrapperId),
    ) as ReadonlyArray<NumberUnaryNodeOperator>;

    const expectedUnaryOperatorKinds: ReadonlyArray<PQP.Language.Constant.UnaryOperatorKind> = [
        PQP.Language.Constant.UnaryOperatorKind.Positive,
        PQP.Language.Constant.UnaryOperatorKind.Negative,
    ];
    const unaryOperators: (
        | PQP.Language.Constant.UnaryOperatorKind.Negative
        | PQP.Language.Constant.UnaryOperatorKind.Positive
    )[] = [];
    let isPositive: boolean = true;

    for (const operator of unaryNodeOperators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return PQP.Language.Type.NoneInstance;
        }

        unaryOperators.push(operator.constantKind);
        if (operator.constantKind === PQP.Language.Constant.UnaryOperatorKind.Negative) {
            isPositive = !isPositive;
        }
    }

    switch (unaryExpressionType.maybeExtendedKind) {
        case PQP.Language.Type.ExtendedTypeKind.NumberLiteral:
            return PQP.Language.TypeUtils.createNumberLiteral(
                unaryExpressionType.isNullable,
                [...unaryOperators, unaryExpressionType.literal].join(""),
            );

        case undefined:
            return unaryExpressionType;

        default:
            throw Assert.isNever(unaryExpressionType);
    }
}

function inspectTypeUnaryLogical<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    unaryExpressionType: PQP.Language.Type.TLogical,
    unaryOperatorWrapperId: number,
): PQP.Language.Type.TLogical | PQP.Language.Type.None {
    const unaryNodeOperators: ReadonlyArray<LogicalUnaryNodeOperator> = Assert.asDefined(
        PQP.Parser.NodeIdMapIterator.maybeIterChildrenAst(state.nodeIdMapCollection, unaryOperatorWrapperId),
    ) as ReadonlyArray<LogicalUnaryNodeOperator>;

    for (const operator of unaryNodeOperators) {
        if (operator.constantKind !== PQP.Language.Constant.UnaryOperatorKind.Not) {
            return PQP.Language.Type.NoneInstance;
        }
    }

    return unaryExpressionType;
}
