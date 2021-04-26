// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position } from "vscode-languageserver-types";

import { PositionUtils } from "..";
import { ActiveNode, ActiveNodeKind, ActiveNodeLeafKind, OutOfBoundPosition, TMaybeActiveNode } from "./activeNode";

// Searches all leaf PQP.Language.Ast.TNodes and all Context nodes to find the "active" node.
// ' 1 + |' -> the second operand, a Context node, in an ArithmeticExpression.
// 'let x=|1 in x' -> the value part of the key-value-pair.
// 'foo(|)' -> the zero length ArrayWrapper of an InvokeExpression
//
// The naive approach is to find the closest Ast or Context node either to the left of or ends on the cursor.
// This approach breaks under several edge cases.
//
// Take a look at the ArithmeticExpression example above,
// it doesn't make sense for the ActiveNode to be the '+' PQP.Language.constant.
// When the position is on a constant the selected PQP.Language.Ast.TNode might need to be shifted one to the right.
// This happens with atomic constants such as '+', '=>', '[', '(' etc.
// However if you shifted right on '(' for 'foo(|)' then the ActiveNode would be ')' instead of the ArrayWrapper.
//
// Sometimes we don't want to shift at all.
// Nodes that prevent shifting are called anchor nodes.
// '[foo = bar|' should be anchored on the identifier 'bar' and not the context node for the ']' PQP.Language.constant.
export function maybeActiveNode(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
): TMaybeActiveNode {
    // Search for the closest Ast node on or to the left of Position, as well as the closest shifted right Ast node.
    const astSearch: AstNodeSearch = maybeFindAstNodes(nodeIdMapCollection, position);
    // Search for the closest Context node on or to the right of the closest Ast node.
    const maybeContextNode: PQP.Parser.ParseContext.Node | undefined = maybeFindContext(nodeIdMapCollection, astSearch);

    let maybeLeaf: PQP.Parser.TXorNode | undefined;
    let leafKind: ActiveNodeLeafKind;
    // Order of node priority:
    //  * shifted
    //  * anchor
    //  * Context
    //  * Ast
    if (astSearch.maybeShiftedRightNode !== undefined) {
        maybeLeaf = PQP.Parser.XorNodeUtils.createAstNode(astSearch.maybeShiftedRightNode);
        leafKind = ActiveNodeLeafKind.ShiftedRight;
    } else if (
        astSearch.maybeBestOnOrBeforeNode !== undefined &&
        isAnchorNode(position, astSearch.maybeBestOnOrBeforeNode)
    ) {
        maybeLeaf = PQP.Parser.XorNodeUtils.createAstNode(astSearch.maybeBestOnOrBeforeNode);
        leafKind = ActiveNodeLeafKind.Anchored;
    } else if (maybeContextNode !== undefined) {
        maybeLeaf = PQP.Parser.XorNodeUtils.createContextNode(maybeContextNode);
        leafKind = ActiveNodeLeafKind.ContextNode;
    } else if (astSearch.maybeBestOnOrBeforeNode !== undefined) {
        maybeLeaf = PQP.Parser.XorNodeUtils.createAstNode(astSearch.maybeBestOnOrBeforeNode);
        leafKind = PositionUtils.isAfterAst(position, astSearch.maybeBestOnOrBeforeNode, false)
            ? ActiveNodeLeafKind.AfterAstNode
            : ActiveNodeLeafKind.OnAstNode;
    } else {
        return createOutOfBoundPosition(position);
    }

    const leaf: PQP.Parser.TXorNode = maybeLeaf;

    return createActiveNode(
        leafKind,
        position,
        PQP.Parser.AncestryUtils.assertGetAncestry(nodeIdMapCollection, leaf.node.id),
        findIdentifierUnderPosition(nodeIdMapCollection, position, leaf),
    );
}

export function createActiveNode(
    leafKind: ActiveNodeLeafKind,
    position: Position,
    ancestry: ReadonlyArray<PQP.Parser.TXorNode>,
    maybeIdentifierUnderPosition: PQP.Language.Ast.Identifier | PQP.Language.Ast.GeneralizedIdentifier | undefined,
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

export function assertActiveNode(nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection, position: Position): ActiveNode {
    const maybeValue: TMaybeActiveNode = maybeActiveNode(nodeIdMapCollection, position);
    assertPositionInBounds(maybeValue);
    return maybeValue;
}

export function assertGetLeaf(activeNode: ActiveNode): PQP.Parser.TXorNode {
    return PQP.Parser.AncestryUtils.assertGetLeaf(activeNode.ancestry);
}

export function assertPositionInBounds(maybeValue: TMaybeActiveNode): asserts maybeValue is ActiveNode {
    if (!isPositionInBounds(maybeValue)) {
        throw new PQP.CommonError.InvariantError(`maybeValue did not have position in bounds`);
    }
}

export function isPositionInBounds(maybeValue: TMaybeActiveNode): maybeValue is ActiveNode {
    return maybeValue.kind === ActiveNodeKind.ActiveNode;
}

export function maybeFirstXorOfNodeKind(
    activeNode: ActiveNode,
    nodeKind: PQP.Language.Ast.NodeKind,
): PQP.Parser.TXorNode | undefined {
    return PQP.Parser.AncestryUtils.maybeFirstXorWhere(
        activeNode.ancestry,
        (xorNode: PQP.Parser.TXorNode) => xorNode.node.kind === nodeKind,
    );
}

interface AstNodeSearch {
    readonly maybeBestOnOrBeforeNode: PQP.Language.Ast.TNode | undefined;
    readonly maybeShiftedRightNode: PQP.Language.Ast.TNode | undefined;
}

const DrilldownConstantKind: ReadonlyArray<string> = [
    PQP.Language.Constant.WrapperConstantKind.LeftBrace,
    PQP.Language.Constant.WrapperConstantKind.LeftBracket,
    PQP.Language.Constant.WrapperConstantKind.LeftParenthesis,
];

const ShiftRightConstantKinds: ReadonlyArray<string> = [
    PQP.Language.Constant.MiscConstantKind.Comma,
    PQP.Language.Constant.MiscConstantKind.Equal,
    PQP.Language.Constant.MiscConstantKind.FatArrow,
    PQP.Language.Constant.WrapperConstantKind.RightBrace,
    PQP.Language.Constant.WrapperConstantKind.RightBracket,
    PQP.Language.Constant.WrapperConstantKind.RightParenthesis,
    PQP.Language.Constant.MiscConstantKind.Semicolon,
    ...DrilldownConstantKind,
];

function isAnchorNode(position: Position, astNode: PQP.Language.Ast.TNode): boolean {
    if (!PositionUtils.isInAst(position, astNode, true, true)) {
        return false;
    }

    if (
        astNode.kind === PQP.Language.Ast.NodeKind.Identifier ||
        astNode.kind === PQP.Language.Ast.NodeKind.GeneralizedIdentifier
    ) {
        return true;
    } else if (
        astNode.kind === PQP.Language.Ast.NodeKind.LiteralExpression &&
        astNode.literalKind === PQP.Language.Ast.LiteralKind.Numeric
    ) {
        return true;
    } else if (astNode.kind === PQP.Language.Ast.NodeKind.Constant) {
        switch (astNode.constantKind) {
            case PQP.Language.Constant.KeywordConstantKind.As:
            case PQP.Language.Constant.KeywordConstantKind.Each:
            case PQP.Language.Constant.KeywordConstantKind.Else:
            case PQP.Language.Constant.KeywordConstantKind.Error:
            case PQP.Language.Constant.KeywordConstantKind.If:
            case PQP.Language.Constant.KeywordConstantKind.In:
            case PQP.Language.Constant.KeywordConstantKind.Is:
            case PQP.Language.Constant.KeywordConstantKind.Section:
            case PQP.Language.Constant.KeywordConstantKind.Shared:
            case PQP.Language.Constant.KeywordConstantKind.Let:
            case PQP.Language.Constant.KeywordConstantKind.Meta:
            case PQP.Language.Constant.KeywordConstantKind.Otherwise:
            case PQP.Language.Constant.KeywordConstantKind.Then:
            case PQP.Language.Constant.KeywordConstantKind.Try:
            case PQP.Language.Constant.KeywordConstantKind.Type:

            case PQP.Language.Constant.PrimitiveTypeConstantKind.Null:
                return true;

            default:
                return false;
        }
    } else {
        return false;
    }
}

function maybeFindAstNodes(nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection, position: Position): AstNodeSearch {
    const astNodeById: PQP.Parser.NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let maybeBestOnOrBeforeNode: PQP.Language.Ast.TNode | undefined;
    let maybeBestAfter: PQP.Language.Ast.TNode | undefined;
    let maybeShiftedRightNode: PQP.Language.Ast.TNode | undefined;

    // Find:
    //  the closest leaf to the left or on position.
    //  the closest leaf to the right of position.
    for (const nodeId of nodeIdMapCollection.leafIds) {
        const maybeCandidate: PQP.Language.Ast.TNode | undefined = astNodeById.get(nodeId);
        if (maybeCandidate === undefined) {
            continue;
        }
        const candidate: PQP.Language.Ast.TNode = maybeCandidate;

        let isBoundIncluded: boolean;
        if (
            // let x|=1
            (candidate.kind === PQP.Language.Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(candidate.constantKind) !== -1) ||
            // let x=|1
            (maybeBestOnOrBeforeNode?.kind === PQP.Language.Ast.NodeKind.Constant &&
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
    if (maybeBestOnOrBeforeNode?.kind === PQP.Language.Ast.NodeKind.Constant) {
        const currentOnOrBefore: PQP.Language.Ast.TConstant = maybeBestOnOrBeforeNode;

        // Requires a shift into an empty ArrayWrapper.
        if (
            DrilldownConstantKind.indexOf(maybeBestOnOrBeforeNode.constantKind) !== -1 &&
            maybeBestAfter?.kind === PQP.Language.Ast.NodeKind.Constant &&
            PQP.Language.ConstantUtils.isPairedWrapperConstantKinds(
                maybeBestOnOrBeforeNode.constantKind,
                maybeBestAfter.constantKind,
            )
        ) {
            const parent: PQP.Language.Ast.TNode = PQP.Parser.NodeIdMapUtils.assertGetParentAst(
                nodeIdMapCollection,
                currentOnOrBefore.id,
                [
                    PQP.Language.Ast.NodeKind.RecordExpression,
                    PQP.Language.Ast.NodeKind.RecordLiteral,
                    PQP.Language.Ast.NodeKind.ListExpression,
                    PQP.Language.Ast.NodeKind.ListLiteral,
                    PQP.Language.Ast.NodeKind.InvokeExpression,
                ],
            );
            const arrayWrapper: PQP.Language.Ast.TNode = PQP.Parser.NodeIdMapUtils.assertGetChildAstByAttributeIndex(
                nodeIdMapCollection,
                parent.id,
                1,
                [PQP.Language.Ast.NodeKind.ArrayWrapper],
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
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    astNodeSearch: AstNodeSearch,
): PQP.Parser.ParseContext.Node | undefined {
    if (astNodeSearch.maybeBestOnOrBeforeNode === undefined) {
        return undefined;
    }
    const tokenIndexLowBound: number = astNodeSearch.maybeBestOnOrBeforeNode.tokenRange.tokenIndexStart;

    let maybeCurrent: PQP.Parser.ParseContext.Node | undefined = undefined;
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
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    leaf: PQP.Parser.TXorNode,
): PQP.Language.Ast.Identifier | PQP.Language.Ast.GeneralizedIdentifier | undefined {
    if (PQP.Parser.XorNodeUtils.isContext(leaf)) {
        return undefined;
    }

    let identifier: PQP.Language.Ast.Identifier | PQP.Language.Ast.GeneralizedIdentifier;

    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (
        leaf.node.kind === PQP.Language.Ast.NodeKind.Constant &&
        leaf.node.constantKind === PQP.Language.Constant.MiscConstantKind.AtSign
    ) {
        const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(leaf.node.id);
        if (maybeParentId === undefined) {
            return undefined;
        }
        const parentId: number = maybeParentId;

        const parent: PQP.Language.Ast.TNode = PQP.Parser.NodeIdMapUtils.assertGetAst(
            nodeIdMapCollection.astNodeById,
            parentId,
        );
        if (parent.kind !== PQP.Language.Ast.NodeKind.IdentifierExpression) {
            return undefined;
        }
        identifier = parent.identifier;
    } else if (
        leaf.node.kind === PQP.Language.Ast.NodeKind.Identifier ||
        leaf.node.kind === PQP.Language.Ast.NodeKind.GeneralizedIdentifier
    ) {
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
