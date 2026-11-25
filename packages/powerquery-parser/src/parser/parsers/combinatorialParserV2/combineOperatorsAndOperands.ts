// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils } from "../../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../../language";
import { CombinatorialParserV2TraceConstant, OperatorsAndOperands, TOperand } from "./commonTypes";
import { NodeIdMap, NodeIdMapUtils, ParseContext, ParseContextUtils, ParseStateUtils } from "../..";
import { NaiveParseSteps } from "..";
import { Parser } from "../../parser";
import { ParseState } from "../../parseState";
import { Trace } from "../../../common/trace";

// Takes N operators and N+1 operands.
// Continually combines the highest precedence operators the operands they're adjacent to,
// thus reducing the number of operators and operands by 1 per iteration.
// Ends with 0 operators and 1 operand.
export async function combineOperatorsAndOperands(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operatorsAndOperands: OperatorsAndOperands,
    correlationId: number,
): Promise<TOperand> {
    const { operatorConstants, operands }: OperatorsAndOperands = operatorsAndOperands;

    Assert.isTrue(
        operatorConstants.length + 1 === operands.length,
        `operators.length !== (operands.length + 1) failed`,
        {
            operandsLength: operands.length,
            operatorsLength: operatorConstants.length,
        },
    );

    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        combineOperatorsAndOperands.name,
        correlationId,
    );

    // Link adjacent operators and group them by precedence without copying the operands.
    const operatorsByPrecedence: Map<number, AdjacentOperator[]> = new Map();
    let previous: AdjacentOperator | undefined;

    for (let index: number = 0; index < operatorConstants.length; index += 1) {
        pollReductionWork(state);

        const operatorConstant: Ast.TBinOpExpressionConstant = ArrayUtils.assertGet(operatorConstants, index);
        const precedence: number = ConstantUtils.binOpExpressionOperatorPrecedence(operatorConstant.constantKind);

        const operator: AdjacentOperator = {
            operatorConstant,
            left: ArrayUtils.assertGet(operands, index),
            right: ArrayUtils.assertGet(operands, index + 1),
            previous,
            next: undefined,
        };

        if (previous) {
            previous.next = operator;
        }

        const bucket: AdjacentOperator[] | undefined = operatorsByPrecedence.get(precedence);

        if (bucket) {
            bucket.push(operator);
        } else {
            operatorsByPrecedence.set(precedence, [operator]);
        }

        previous = operator;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    let result: TOperand = ArrayUtils.assertGet(operands, 0);

    // Only the fixed number of distinct precedences is sorted. Buckets retain document order,
    // including reductions in disconnected subtrees, which determines diagnostics and node IDs.
    for (const precedence of [...operatorsByPrecedence.keys()].sort((left: number, right: number) => right - left)) {
        for (const operator of MapUtils.assertGet(operatorsByPrecedence, precedence)) {
            pollReductionWork(state);

            const { left, right, operatorConstant }: AdjacentOperator = operator;

            const nodeKind: Ast.TBinOpExpressionNodeKind = AstUtils.nodeKindFromTBinOpExpressionOperator(
                operatorConstant.constantKind,
            );

            const binOpParseContext: ParseContext.TNode = ParseContextUtils.startContext(
                state.contextState,
                nodeKind,
                left.tokenRange.tokenIndexStart,
                state.lexerSnapshot.tokens[left.tokenRange.tokenIndexStart],
                undefined,
            );

            placeParseContextUnderPlaceholderContext(state, binOpParseContext, placeholderContextNodeId);

            const validator: TValidator = validatorForOperator(operatorConstant.constantKind);

            if (!validator.validateLeftOperand(left)) {
                setParseStateToNodeStart(state, left);
                // eslint-disable-next-line no-await-in-loop
                await validator.fallbackLeftOperand(state, parser, trace.id);
                throw new CommonError.InvariantError(
                    `validateLeftOperand failed and then fallbackLeftOperand did not throw.`,
                );
            }

            addAstAsChild(nodeIdMapCollection, binOpParseContext, left);
            addAstAsChild(nodeIdMapCollection, binOpParseContext, operatorConstant);

            if (!validator.validateRightOperand(right)) {
                setParseStateToAfterNodeEnd(state, operatorConstant);
                // eslint-disable-next-line no-await-in-loop
                await validator.fallbackRightOperand(state, parser, trace.id);
                throw new CommonError.InvariantError(
                    `validateRightOperand failed and then fallbackRightOperand did not throw.`,
                );
            }

            addAstAsChild(nodeIdMapCollection, binOpParseContext, right);
            setParseStateToAfterNodeEnd(state, right);

            const leftTokenRange: Token.TokenRange = left.tokenRange;
            const rightTokenRange: Token.TokenRange = right.tokenRange;

            // We started with an operatorConstant belonging under TBinOpExpression["operatorConstant"].
            // Working backwards, we derived the nodeKind for some TBinOpExpression `T` and validators
            // which should validate left is `T["left"]` and right is `T["right"]`.
            // Therefore, we should be able to cast it as a TBinOpExpression.
            const binOp: Ast.TBinOpExpression = {
                kind: nodeKind,
                id: binOpParseContext.id,
                attributeIndex: 0,
                tokenRange: {
                    tokenIndexStart: leftTokenRange.tokenIndexStart,
                    tokenIndexEnd: rightTokenRange.tokenIndexEnd,
                    positionStart: leftTokenRange.positionStart,
                    positionEnd: rightTokenRange.positionEnd,
                },
                isLeaf: false,
                left,
                operatorConstant,
                right,
            } as unknown as Ast.TBinOpExpression;

            // Promote from ParseContext into Ast
            nodeIdMapCollection.astNodeById.set(binOp.id, binOp);
            MapUtils.assertDelete(nodeIdMapCollection.contextNodeById, binOp.id);

            if (operator.previous) {
                operator.previous.right = binOp;
                operator.previous.next = operator.next;
            }

            if (operator.next) {
                operator.next.left = binOp;
                operator.next.previous = operator.previous;
            }

            result = binOp;
        }
    }

    Assert.isTrue(
        AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result),
        `AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result) failed`,
        { resultNodeKind: result.kind },
    );

    trace.exit();

    return result;
}

type TEqualityExpressionAndBelow = Ast.ArithmeticExpression | Ast.EqualityExpression | Ast.RelationalExpression;

type TValidator =
    | Validator<Ast.AsExpression>
    | Validator<Ast.IsExpression>
    | Validator<Ast.LogicalExpression>
    | Validator<Ast.MetadataExpression>
    | Validator<Ast.NullCoalescingExpression>
    | Validator<TEqualityExpressionAndBelow>;

interface AdjacentOperator {
    readonly operatorConstant: Ast.TBinOpExpressionConstant;
    left: TOperand;
    right: TOperand;
    previous: AdjacentOperator | undefined;
    next: AdjacentOperator | undefined;
}

interface Validator<Node extends Ast.TBinOpExpression> {
    // The tag has zero functional use.
    // It's only exists because I'm lazy while debugging.
    readonly tag:
        | "AsExpression"
        | "EqualityExpression"
        | "IsExpression"
        | "LogicalAndExpression"
        | "LogicalOrExpression"
        | "MetadataExpression"
        | "NullCoalescingExpression";
    // Checks if the left/right operand is of the correct type
    readonly validateLeftOperand: (node: Ast.TNode) => node is Node["left"];
    readonly validateRightOperand: (node: Ast.TNode) => node is Node["right"];
    // If left/right operand is the wrong type, then it should fallback to a call to NaiveParseStep,
    // which in turn should throw some sort of exception.
    readonly fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) => Promise<Ast.TNode>;
    readonly fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) => Promise<Ast.TNode>;
}

const ValidatorForAsExpression: Validator<Ast.AsExpression> = {
    tag: "AsExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TAsExpression => AstUtils.isTAsExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullablePrimitiveType =>
        AstUtils.isTNullablePrimitiveType(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readEqualityExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const ValidatorForEqualityExpressionAndBelow: Validator<TEqualityExpressionAndBelow> = {
    tag: "EqualityExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TEqualityExpression => AstUtils.isTEqualityExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TEqualityExpression => AstUtils.isTEqualityExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
};

const ValidatorForIsExpression: Validator<Ast.IsExpression> = {
    tag: "IsExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullablePrimitiveType =>
        AstUtils.isTNullablePrimitiveType(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const ValidatorForLogicalAndExpression: Validator<Ast.LogicalExpression> = {
    tag: "LogicalAndExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readIsExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readIsExpression(state, parser, correlationId),
};

const ValidatorForLogicalOrExpression: Validator<Ast.LogicalExpression> = {
    tag: "LogicalOrExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: isTIsExpressionOrLogicalAndExpression,
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const ValidatorForNullCoalescingExpression: Validator<Ast.NullCoalescingExpression> = {
    tag: "NullCoalescingExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullCoalescingExpression =>
        AstUtils.isTNullCoalescingExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const ValidatorForMetadataExpression: Validator<Ast.MetadataExpression> = {
    tag: "MetadataExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
};

function addAstAsChild(nodeIdMapCollection: NodeIdMap.Collection, parent: ParseContext.TNode, child: Ast.TNode): void {
    parent.attributeCounter += 1;

    const parentId: number = parent.id;
    nodeIdMapCollection.astNodeById.set(child.id, child);
    nodeIdMapCollection.parentIdById.set(child.id, parentId);
    NodeIdMapUtils.appendChildId(nodeIdMapCollection.childIdsById, parentId, child.id);

    if (child.isLeaf) {
        nodeIdMapCollection.leafIds.add(child.id);
    }

    addNodeKindToCollection(nodeIdMapCollection.idsByNodeKind, child.kind, child.id);
}

function addNodeKindToCollection(
    idsByNodeKind: Map<Ast.NodeKind, Set<number>>,
    nodeKind: Ast.NodeKind,
    nodeId: number,
): void {
    const collection: Set<number> | undefined = idsByNodeKind.get(nodeKind);

    if (collection) {
        collection.add(nodeId);
    } else {
        idsByNodeKind.set(nodeKind, new Set([nodeId]));
    }
}

function isTIsExpressionOrLogicalAndExpression(node: Ast.TNode): node is Ast.TLogicalExpression {
    return (
        AstUtils.isTIsExpression(node) ||
        (AstUtils.isNodeKind<Ast.LogicalExpression>(node, Ast.NodeKind.LogicalExpression) &&
            node.operatorConstant.constantKind === Constant.LogicalOperator.And)
    );
}

function placeParseContextUnderPlaceholderContext(
    state: ParseState,
    parseContext: ParseContext.TNode,
    placeholderContextNodeId: number,
): void {
    state.currentContextNode = parseContext;

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    nodeIdMapCollection.childIdsById.set(placeholderContextNodeId, [parseContext.id]);
    nodeIdMapCollection.parentIdById.set(parseContext.id, placeholderContextNodeId);
}

function setParseStateToNodeStart(state: ParseState, node: Ast.TNode): void {
    setParseStateToTokenIndex(state, node.tokenRange.tokenIndexStart);
}

function setParseStateToAfterNodeEnd(state: ParseState, node: Ast.TNode): void {
    setParseStateToTokenIndex(state, node.tokenRange.tokenIndexEnd + 1);
}

function setParseStateToTokenIndex(state: ParseState, tokenIndex: number): void {
    const token: Token.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];

    state.currentToken = token;
    state.currentTokenKind = token?.kind;
    state.tokenIndex = tokenIndex;
}

function pollReductionWork(state: ParseState): void {
    if (state.speculativeWorkBudget.depth > 0) {
        ParseStateUtils.consumeSpeculativeWork(state);
    } else {
        state.cancellationToken?.throwIfCancelled();
    }
}

function validatorForOperator(operator: Constant.TBinOpExpressionOperator): TValidator {
    switch (operator) {
        case Constant.ArithmeticOperator.Multiplication:
        case Constant.ArithmeticOperator.Division:
        case Constant.ArithmeticOperator.Addition:
        case Constant.ArithmeticOperator.Subtraction:
        case Constant.ArithmeticOperator.And:
        case Constant.RelationalOperator.LessThan:
        case Constant.RelationalOperator.LessThanEqualTo:
        case Constant.RelationalOperator.GreaterThan:
        case Constant.RelationalOperator.GreaterThanEqualTo:
        case Constant.EqualityOperator.EqualTo:
        case Constant.EqualityOperator.NotEqualTo:
            return ValidatorForEqualityExpressionAndBelow;

        case Constant.KeywordConstant.Meta:
            return ValidatorForMetadataExpression;

        case Constant.KeywordConstant.As:
            return ValidatorForAsExpression;

        case Constant.KeywordConstant.Is:
            return ValidatorForIsExpression;

        case Constant.LogicalOperator.And:
            return ValidatorForLogicalAndExpression;

        case Constant.LogicalOperator.Or:
            return ValidatorForLogicalOrExpression;

        case Constant.MiscConstant.NullCoalescingOperator:
            return ValidatorForNullCoalescingExpression;

        default:
            throw Assert.isNever(operator);
    }
}
