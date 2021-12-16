// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Position } from "vscode-languageserver-types";

import { PositionUtils } from "../..";
import { ActiveNode, ActiveNodeKind, ActiveNodeLeafKind, OutOfBoundPosition, TMaybeActiveNode } from "./activeNode";

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
export function maybeActiveNode(nodeIdMapCollection: NodeIdMap.Collection, position: Position): TMaybeActiveNode {
    // Search for the closest Ast node on or to the left of Position, as well as the closest shifted right Ast node.
    const astSearch: AstNodeSearch = maybeFindAstNodes(nodeIdMapCollection, position);
    // Search for the closest Context node on or to the right of the closest Ast node.
    const maybeContextNode: PQP.Parser.ParseContext.TNode | undefined = maybeFindContext(
        nodeIdMapCollection,
        astSearch,
    );

    let maybeLeaf: TXorNode | undefined;
    let leafKind: ActiveNodeLeafKind;
    // Order of node priority:
    //  * shifted
    //  * anchor
    //  * Context
    //  * Ast
    if (astSearch.maybeShiftedRightNode !== undefined) {
        maybeLeaf = XorNodeUtils.boxAst(astSearch.maybeShiftedRightNode);
        leafKind = ActiveNodeLeafKind.ShiftedRight;
    } else if (
        astSearch.maybeBestOnOrBeforeNode !== undefined &&
        isAnchorNode(position, astSearch.maybeBestOnOrBeforeNode)
    ) {
        maybeLeaf = XorNodeUtils.boxAst(astSearch.maybeBestOnOrBeforeNode);
        leafKind = ActiveNodeLeafKind.Anchored;
    } else if (maybeContextNode !== undefined) {
        maybeLeaf = XorNodeUtils.boxContext(maybeContextNode);
        leafKind = ActiveNodeLeafKind.ContextNode;
    } else if (astSearch.maybeBestOnOrBeforeNode !== undefined) {
        maybeLeaf = XorNodeUtils.boxAst(astSearch.maybeBestOnOrBeforeNode);
        leafKind = PositionUtils.isAfterAst(position, astSearch.maybeBestOnOrBeforeNode, false)
            ? ActiveNodeLeafKind.AfterAstNode
            : ActiveNodeLeafKind.OnAstNode;
    } else {
        return createOutOfBoundPosition(position);
    }

    const leaf: TXorNode = maybeLeaf;

    return createActiveNode(
        leafKind,
        position,
        AncestryUtils.assertGetAncestry(nodeIdMapCollection, leaf.node.id),
        findIdentifierUnderPosition(nodeIdMapCollection, position, leaf),
    );
}

export function createActiveNode(
    leafKind: ActiveNodeLeafKind,
    position: Position,
    ancestry: ReadonlyArray<TXorNode>,
    maybeIdentifierUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined,
): ActiveNode {
    return {
        kind: ActiveNodeKind.ActiveNode,
        leafKind,
        position,
        ancestry,
        maybeIdentifierUnderPosition,
    };
}

export function createOutOfBoundPosition(position: Position): OutOfBoundPosition {
    return {
        kind: ActiveNodeKind.OutOfBoundPosition,
        position,
    };
}

export function assertActiveNode(nodeIdMapCollection: NodeIdMap.Collection, position: Position): ActiveNode {
    const maybeValue: TMaybeActiveNode = maybeActiveNode(nodeIdMapCollection, position);
    assertPositionInBounds(maybeValue);
    return maybeValue;
}

export function assertGetLeaf(activeNode: ActiveNode): TXorNode {
    return AncestryUtils.assertGetLeaf(activeNode.ancestry);
}

export function assertPositionInBounds(maybeValue: TMaybeActiveNode): asserts maybeValue is ActiveNode {
    if (!isPositionInBounds(maybeValue)) {
        throw new PQP.CommonError.InvariantError(`maybeValue did not have position in bounds`);
    }
}

export function isPositionInBounds(maybeValue: TMaybeActiveNode): maybeValue is ActiveNode {
    return maybeValue.kind === ActiveNodeKind.ActiveNode;
}

export function maybeFirstXorOfNodeKind<T extends Ast.TNode>(
    activeNode: ActiveNode,
    nodeKind: T["kind"],
): XorNode<T> | undefined {
    return AncestryUtils.maybeFirstXorOfNodeKind(activeNode.ancestry, nodeKind);
}

interface AstNodeSearch {
    readonly maybeBestOnOrBeforeNode: Ast.TNode | undefined;
    readonly maybeShiftedRightNode: Ast.TNode | undefined;
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

function maybeFindAstNodes(nodeIdMapCollection: NodeIdMap.Collection, position: Position): AstNodeSearch {
    const astNodeById: PQP.Parser.NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let maybeBestOnOrBeforeNode: Ast.TNode | undefined;
    let maybeBestAfter: Ast.TNode | undefined;
    let maybeShiftedRightNode: Ast.TNode | undefined;

    // Find:
    //  the closest leaf to the left or on position.
    //  the closest leaf to the right of position.
    for (const nodeId of nodeIdMapCollection.leafIds) {
        const maybeCandidate: Ast.TNode | undefined = astNodeById.get(nodeId);
        if (maybeCandidate === undefined) {
            continue;
        }
        const candidate: Ast.TNode = maybeCandidate;

        let isBoundIncluded: boolean;
        if (
            // let x|=1
            (candidate.kind === Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(candidate.constantKind) !== -1) ||
            // let x=|1
            (maybeBestOnOrBeforeNode?.kind === Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(maybeBestOnOrBeforeNode.constantKind) !== -1)
        ) {
            isBoundIncluded = false;
        } else {
            isBoundIncluded = true;
        }

        if (!PositionUtils.isBeforeTokenPosition(position, candidate.tokenRange.positionStart, isBoundIncluded)) {
            if (
                maybeBestOnOrBeforeNode === undefined ||
                candidate.tokenRange.tokenIndexStart > maybeBestOnOrBeforeNode.tokenRange.tokenIndexStart
            ) {
                maybeBestOnOrBeforeNode = candidate;
            }
        }
        // Check if after position.
        else if (
            maybeBestAfter === undefined ||
            candidate.tokenRange.tokenIndexStart < maybeBestAfter.tokenRange.tokenIndexStart
        ) {
            maybeBestAfter = candidate;
        }
    }

    // Might need to shift.
    if (maybeBestOnOrBeforeNode?.kind === Ast.NodeKind.Constant) {
        const currentOnOrBefore: Ast.TConstant = maybeBestOnOrBeforeNode;

        // Requires a shift into an empty ArrayWrapper.
        if (
            DrilldownConstantKind.indexOf(maybeBestOnOrBeforeNode.constantKind) !== -1 &&
            maybeBestAfter?.kind === Ast.NodeKind.Constant &&
            PQP.Language.ConstantUtils.isPairedWrapperConstantKinds(
                maybeBestOnOrBeforeNode.constantKind,
                maybeBestAfter.constantKind,
            )
        ) {
            const parent:
                | Ast.RecordExpression
                | Ast.RecordLiteral
                | Ast.ListExpression
                | Ast.ListLiteral
                | Ast.InvokeExpression = NodeIdMapUtils.assertUnboxParentAstChecked(
                nodeIdMapCollection,
                currentOnOrBefore.id,
                [
                    Ast.NodeKind.RecordExpression,
                    Ast.NodeKind.RecordLiteral,
                    Ast.NodeKind.ListExpression,
                    Ast.NodeKind.ListLiteral,
                    Ast.NodeKind.InvokeExpression,
                ],
            );
            const arrayWrapper: Ast.TArrayWrapper = NodeIdMapUtils.assertUnboxArrayWrapperAst(
                nodeIdMapCollection,
                parent.id,
            );
            maybeShiftedRightNode = arrayWrapper;
        }
        // Requires a shift to the right.
        else if (ShiftRightConstantKinds.indexOf(currentOnOrBefore.constantKind) !== -1) {
            maybeShiftedRightNode = maybeBestAfter;
        }
        // No shifting.
        else {
            maybeShiftedRightNode = undefined;
        }
    } else {
        maybeShiftedRightNode = undefined;
    }

    return {
        maybeBestOnOrBeforeNode,
        maybeShiftedRightNode,
    };
}

function maybeFindContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    astNodeSearch: AstNodeSearch,
): PQP.Parser.ParseContext.TNode | undefined {
    if (astNodeSearch.maybeBestOnOrBeforeNode === undefined) {
        return undefined;
    }
    const tokenIndexLowBound: number = astNodeSearch.maybeBestOnOrBeforeNode.tokenRange.tokenIndexStart;

    let maybeCurrent: PQP.Parser.ParseContext.TNode | undefined = undefined;
    for (const candidate of nodeIdMapCollection.contextNodeById.values()) {
        if (candidate.maybeTokenStart) {
            if (candidate.tokenIndexStart < tokenIndexLowBound) {
                continue;
            }

            if (maybeCurrent === undefined || maybeCurrent.id < candidate.id) {
                maybeCurrent = candidate;
            }
        }
    }

    return maybeCurrent;
}

function findIdentifierUnderPosition(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    leaf: TXorNode,
): Ast.Identifier | Ast.GeneralizedIdentifier | undefined {
    if (XorNodeUtils.isContextXor(leaf)) {
        return undefined;
    }

    let identifier: Ast.Identifier | Ast.GeneralizedIdentifier;

    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (leaf.node.kind === Ast.NodeKind.Constant && leaf.node.constantKind === Constant.MiscConstant.AtSign) {
        const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(leaf.node.id);
        if (maybeParentId === undefined) {
            return undefined;
        }
        const parentId: number = maybeParentId;

        const parent: Ast.TNode = NodeIdMapUtils.assertUnboxAst(nodeIdMapCollection.astNodeById, parentId);
        if (parent.kind !== Ast.NodeKind.IdentifierExpression) {
            return undefined;
        }
        identifier = parent.identifier;
    } else if (leaf.node.kind === Ast.NodeKind.Identifier || leaf.node.kind === Ast.NodeKind.GeneralizedIdentifier) {
        identifier = leaf.node;
    } else {
        return undefined;
    }

    if (PositionUtils.isInAst(position, identifier, false, true)) {
        return identifier;
    } else {
        return undefined;
    }
}
