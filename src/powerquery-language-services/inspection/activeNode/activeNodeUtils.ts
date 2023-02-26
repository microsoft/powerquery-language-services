// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    ParseContext,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert, CommonError } from "@microsoft/powerquery-parser";
import { Ast, Constant, ConstantUtils, TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { Position } from "vscode-languageserver-types";

import {
    ActiveNode,
    ActiveNodeKind,
    ActiveNodeLeafKind,
    OutOfBoundPosition,
    TActiveLeafIdentifier,
    TActiveNode,
} from "./activeNode";
import { PositionUtils } from "../..";

// Searches all leaf Ast.TNodes and all Context nodes to find the "active" node.
// ' 1 + |' -> the second operand, a Context node, in an ArithmeticExpression.
// 'let x=|1 in x' -> the value part of the key-value-pair.
// 'foo(|)' -> the zero length ArrayWrapper of an InvokeExpression
//
// The naive approach is to find the closest Ast or Context node either to the left of or ends on the cursor.
// This approach breaks under several edge cases.
//
// Take a look at the ArithmeticExpression example above,
// it doesn't make sense for the ActiveNode to be the '+' Constant.
// When the position is on a constant the selected Ast.TNode might need to be shifted one to the right.
// This happens with atomic constants such as '+', '=>', '[', '(' etc.
// However if you shifted right on '(' for 'foo(|)' then the ActiveNode would be ')' instead of the ArrayWrapper.
//
// Sometimes we don't want to shift at all.
// Nodes that prevent shifting are called anchor nodes.
// '[foo = bar|' should be anchored on the identifier 'bar' and not the context node for the ']' Constant.
export function activeNode(nodeIdMapCollection: NodeIdMap.Collection, position: Position): TActiveNode {
    // Search for the closest Ast node on or to the left of Position, as well as the closest shifted right Ast node.
    const astSearch: AstNodeSearch = astNodeSearch(nodeIdMapCollection, position);

    // Search for the closest Context node on or to the right of the closest Ast node.
    const contextNode: ParseContext.TNode | undefined = findContext(nodeIdMapCollection, astSearch);

    let leaf: TXorNode | undefined;
    let leafKind: ActiveNodeLeafKind;

    // Order of node priority:
    //  * shifted
    //  * anchor
    //  * Context
    //  * Ast
    if (astSearch.shiftedRightNode !== undefined) {
        leaf = XorNodeUtils.boxAst(astSearch.shiftedRightNode);
        leafKind = ActiveNodeLeafKind.ShiftedRight;
    } else if (astSearch.bestOnOrBeforeNode !== undefined && isAnchorNode(position, astSearch.bestOnOrBeforeNode)) {
        leaf = XorNodeUtils.boxAst(astSearch.bestOnOrBeforeNode);
        leafKind = ActiveNodeLeafKind.Anchored;
    } else if (contextNode !== undefined) {
        leaf = XorNodeUtils.boxContext(contextNode);
        leafKind = ActiveNodeLeafKind.ContextNode;
    } else if (astSearch.bestOnOrBeforeNode !== undefined) {
        leaf = XorNodeUtils.boxAst(astSearch.bestOnOrBeforeNode);

        leafKind = PositionUtils.isAfterAst(position, astSearch.bestOnOrBeforeNode, false)
            ? ActiveNodeLeafKind.AfterAstNode
            : ActiveNodeLeafKind.OnAstNode;
    } else {
        return createOutOfBoundPosition(position);
    }

    const inclusiveIdentifierUnderPosition: TActiveLeafIdentifier | undefined = findLeafIdentifier(
        nodeIdMapCollection,
        leaf,
    );

    const exclusiveIdentifierUnderPosition: TActiveLeafIdentifier | undefined =
        inclusiveIdentifierUnderPosition &&
        PositionUtils.isInAst(position, inclusiveIdentifierUnderPosition.node, false, true)
            ? inclusiveIdentifierUnderPosition
            : undefined;

    const ancestry: ReadonlyArray<TXorNode> = AncestryUtils.assertGetAncestry(nodeIdMapCollection, leaf.node.id);

    return {
        kind: ActiveNodeKind.ActiveNode,
        leafKind,
        position,
        ancestry,
        exclusiveIdentifierUnderPosition,
        inclusiveIdentifierUnderPosition,
    };
}

export function createOutOfBoundPosition(position: Position): OutOfBoundPosition {
    return {
        kind: ActiveNodeKind.OutOfBoundPosition,
        position,
    };
}

export function assertActiveNode(nodeIdMapCollection: NodeIdMap.Collection, position: Position): ActiveNode {
    const value: TActiveNode = activeNode(nodeIdMapCollection, position);
    assertPositionInBounds(value);

    return value;
}

export function assertGetLeaf(activeNode: ActiveNode): TXorNode {
    return AncestryUtils.assertGetLeaf(activeNode.ancestry);
}

export function assertPositionInBounds(value: TActiveNode): asserts value is ActiveNode {
    if (!isPositionInBounds(value)) {
        throw new CommonError.InvariantError(`value was not in bounds`);
    }
}

export function isPositionInBounds(value: TActiveNode): value is ActiveNode {
    return value.kind === ActiveNodeKind.ActiveNode;
}

export function findXorOfNodeKind<T extends Ast.TNode>(
    activeNode: ActiveNode,
    nodeKind: T["kind"],
): XorNode<T> | undefined {
    return AncestryUtils.findXorOfNodeKind(activeNode.ancestry, nodeKind);
}

interface AstNodeSearch {
    readonly bestOnOrBeforeNode: Ast.TNode | undefined;
    readonly shiftedRightNode: Ast.TNode | undefined;
}

const DrilldownConstantKind: ReadonlyArray<string> = [
    Constant.WrapperConstant.LeftBrace,
    Constant.WrapperConstant.LeftBracket,
    Constant.WrapperConstant.LeftParenthesis,
];

const ShiftRightConstantKinds: ReadonlyArray<string> = [
    Constant.MiscConstant.Comma,
    Constant.MiscConstant.Equal,
    Constant.MiscConstant.FatArrow,
    Constant.WrapperConstant.RightBrace,
    Constant.WrapperConstant.RightBracket,
    Constant.WrapperConstant.RightParenthesis,
    Constant.MiscConstant.Semicolon,
    ...DrilldownConstantKind,
];

function astNodeSearch(nodeIdMapCollection: NodeIdMap.Collection, position: Position): AstNodeSearch {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let bestOnOrBeforeNode: Ast.TNode | undefined;
    let bestAfter: Ast.TNode | undefined;
    let shiftedRightNode: Ast.TNode | undefined;

    // Find:
    //  the closest leaf to the left or on position.
    //  the closest leaf to the right of position.
    for (const nodeId of nodeIdMapCollection.leafIds) {
        const candidate: Ast.TNode | undefined = astNodeById.get(nodeId);

        if (candidate === undefined) {
            continue;
        }

        let isBoundIncluded: boolean;

        if (
            // let x|=1
            (candidate.kind === Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(candidate.constantKind) !== -1) ||
            // let x=|1
            (bestOnOrBeforeNode?.kind === Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(bestOnOrBeforeNode.constantKind) !== -1)
        ) {
            isBoundIncluded = false;
        } else {
            isBoundIncluded = true;
        }

        if (!PositionUtils.isBeforeTokenPosition(position, candidate.tokenRange.positionStart, isBoundIncluded)) {
            if (
                bestOnOrBeforeNode === undefined ||
                candidate.tokenRange.tokenIndexStart > bestOnOrBeforeNode.tokenRange.tokenIndexStart
            ) {
                bestOnOrBeforeNode = candidate;
            }
        }
        // Check if after position.
        else if (
            bestAfter === undefined ||
            candidate.tokenRange.tokenIndexStart < bestAfter.tokenRange.tokenIndexStart
        ) {
            bestAfter = candidate;
        }
    }

    // Might need to shift.
    if (bestOnOrBeforeNode?.kind === Ast.NodeKind.Constant) {
        const currentOnOrBefore: Ast.TConstant = bestOnOrBeforeNode;

        // Requires a shift into an empty ArrayWrapper.
        if (
            DrilldownConstantKind.indexOf(bestOnOrBeforeNode.constantKind) !== -1 &&
            bestAfter?.kind === Ast.NodeKind.Constant &&
            ConstantUtils.isPairedWrapperConstantKinds(bestOnOrBeforeNode.constantKind, bestAfter.constantKind)
        ) {
            const parent:
                | Ast.RecordExpression
                | Ast.RecordLiteral
                | Ast.ListExpression
                | Ast.ListLiteral
                | Ast.InvokeExpression = NodeIdMapUtils.assertUnboxParentAstChecked<
                Ast.RecordExpression | Ast.RecordLiteral | Ast.ListExpression | Ast.ListLiteral | Ast.InvokeExpression
            >(nodeIdMapCollection, currentOnOrBefore.id, [
                Ast.NodeKind.RecordExpression,
                Ast.NodeKind.RecordLiteral,
                Ast.NodeKind.ListExpression,
                Ast.NodeKind.ListLiteral,
                Ast.NodeKind.InvokeExpression,
            ]);

            const arrayWrapper: Ast.TArrayWrapper = NodeIdMapUtils.assertUnboxArrayWrapperAst(
                nodeIdMapCollection,
                parent.id,
            );

            shiftedRightNode = arrayWrapper;
        }
        // Requires a shift to the right.
        else if (ShiftRightConstantKinds.indexOf(currentOnOrBefore.constantKind) !== -1) {
            shiftedRightNode = bestAfter;
        }
        // No shifting.
        else {
            shiftedRightNode = undefined;
        }
    } else {
        shiftedRightNode = undefined;
    }

    return {
        bestOnOrBeforeNode,
        shiftedRightNode,
    };
}

function findContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    astNodeSearch: AstNodeSearch,
): ParseContext.TNode | undefined {
    if (astNodeSearch.bestOnOrBeforeNode === undefined) {
        return undefined;
    }

    const tokenIndexLowBound: number = astNodeSearch.bestOnOrBeforeNode.tokenRange.tokenIndexStart;
    let current: ParseContext.TNode | undefined = undefined;

    for (const candidate of nodeIdMapCollection.contextNodeById.values()) {
        if (candidate.tokenStart) {
            if (candidate.tokenIndexStart < tokenIndexLowBound) {
                continue;
            }

            if (current === undefined || current.id < candidate.id) {
                current = candidate;
            }
        }
    }

    return current;
}

function findLeafIdentifier(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafXorNode: TXorNode,
): TActiveLeafIdentifier | undefined {
    if (XorNodeUtils.isContextXor(leafXorNode)) {
        return undefined;
    }

    const leaf: Ast.TNode = leafXorNode.node;

    let identifier: Ast.Identifier | Ast.IdentifierExpression | Ast.GeneralizedIdentifier;

    const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(leaf.id);

    if (leaf.kind === Ast.NodeKind.Identifier) {
        if (parentId === undefined) {
            return undefined;
        }

        const parent: Ast.TNode | undefined = NodeIdMapUtils.unboxIfAst(nodeIdMapCollection, parentId);

        if (parent?.kind === Ast.NodeKind.IdentifierPairedExpression) {
            identifier = leaf;
        } else if (parent?.kind === Ast.NodeKind.IdentifierExpression) {
            identifier = parent;
        } else {
            identifier = leaf;
        }
    }
    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    else if (leaf.kind === Ast.NodeKind.Constant && leaf.constantKind === Constant.MiscConstant.AtSign) {
        if (parentId === undefined) {
            return undefined;
        }

        const parent: Ast.TNode | undefined = NodeIdMapUtils.unboxIfAst(nodeIdMapCollection, parentId);

        if (parent?.kind === Ast.NodeKind.IdentifierExpression) {
            identifier = parent;
        } else {
            return undefined;
        }
    } else if (leaf.kind === Ast.NodeKind.GeneralizedIdentifier) {
        identifier = leaf;
    } else {
        return undefined;
    }

    let result: TActiveLeafIdentifier;

    switch (identifier.kind) {
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.GeneralizedIdentifier:
            result = {
                node: identifier,
                isRecursive: false,
                normalizedLiteral: TextUtils.normalizeIdentifier(identifier.literal),
                normalizedRecursiveLiteral: undefined,
            };

            break;

        case Ast.NodeKind.IdentifierExpression: {
            const normalizedLiteral: string = TextUtils.normalizeIdentifier(identifier.identifier.literal);

            result = {
                node: identifier,
                isRecursive: Boolean(identifier.inclusiveConstant),
                normalizedLiteral,
                normalizedRecursiveLiteral: `@${normalizedLiteral}`,
            };

            break;
        }

        default:
            throw Assert.isNever(identifier);
    }

    return result;
}

function isAnchorNode(position: Position, astNode: Ast.TNode): boolean {
    if (!PositionUtils.isInAst(position, astNode, true, true)) {
        return false;
    }

    if (astNode.kind === Ast.NodeKind.Identifier || astNode.kind === Ast.NodeKind.GeneralizedIdentifier) {
        return true;
    } else if (astNode.kind === Ast.NodeKind.LiteralExpression && astNode.literalKind === Ast.LiteralKind.Numeric) {
        return true;
    } else if (astNode.kind === Ast.NodeKind.Constant) {
        switch (astNode.constantKind) {
            case Constant.KeywordConstant.As:
            case Constant.KeywordConstant.Each:
            case Constant.KeywordConstant.Else:
            case Constant.KeywordConstant.Error:
            case Constant.KeywordConstant.If:
            case Constant.KeywordConstant.In:
            case Constant.KeywordConstant.Is:
            case Constant.KeywordConstant.Section:
            case Constant.KeywordConstant.Shared:
            case Constant.KeywordConstant.Let:
            case Constant.KeywordConstant.Meta:
            case Constant.KeywordConstant.Otherwise:
            case Constant.KeywordConstant.Then:
            case Constant.KeywordConstant.Try:
            case Constant.KeywordConstant.Type:
            case Constant.PrimitiveTypeConstant.Null:
                return true;

            default:
                return false;
        }
    } else {
        return false;
    }
}
