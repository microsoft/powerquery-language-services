/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
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
import { ArrayUtils, Assert, CommonError } from "@microsoft/powerquery-parser";
import { Ast, AstUtils, Constant, TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
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

// const DrilldownConstantKind: ReadonlyArray<string> = [
//     Constant.WrapperConstant.LeftBrace,
//     Constant.WrapperConstant.LeftBracket,
//     Constant.WrapperConstant.LeftParenthesis,
// ];

// const ShiftRightConstantKinds: ReadonlyArray<string> = [
//     Constant.MiscConstant.Comma,
//     Constant.MiscConstant.Equal,
//     Constant.MiscConstant.FatArrow,
//     Constant.WrapperConstant.RightBrace,
//     Constant.WrapperConstant.RightBracket,
//     Constant.WrapperConstant.RightParenthesis,
//     Constant.MiscConstant.Semicolon,
//     ...DrilldownConstantKind,
// ];

const ShiftRightConstantKinds: ReadonlyArray<Constant.TConstant> = [
    ...Constant.BinOpExpressionOperators,
    Constant.MiscConstant.Ampersand,
    Constant.MiscConstant.Comma,
    Constant.MiscConstant.DotDot,
    Constant.MiscConstant.Equal,
    Constant.MiscConstant.FatArrow,
    Constant.MiscConstant.NullCoalescingOperator,
];

const CloseWrapperConstants: ReadonlyArray<Constant.TConstant> = [
    Constant.WrapperConstant.RightBrace,
    Constant.WrapperConstant.RightBracket,
    Constant.WrapperConstant.RightParenthesis,
];

// const foobar: ReadonlyArray<TLeaf["kind"]> = [Ast.NodeKind.Identifier, Ast.NodeKind.GeneralizedIdentifier];

// // `let x|=1` -> left
// // `let x=|1` -> center
// // `[|x=1` -> center
// // `[x|=1` -> left
// // `[x=|1` -> center
// // `[|[x=` -> center
// // `[[|x=` -> center
// // `1|&2` -> left
// // `1&|2` -> center
// // `{|1,2} -> center
// // `{1|,2} -> left
// // `{1,|2} -> center
// // `{1,2|} -> left
// function pickOverlappingLeftOrCenterLeaf(left: TLeaf, center: TLeaf, right: TLeaf): LeafAndKind {
//     if (AstUtils.isTConstant(left) && ConjunctionConstants.includes(left.constantKind)) {
//         return {
//             leaf: XorNodeUtils.boxAst(center),
//             leafKind: ActiveNodeLeafKind.ContextNode,
//         };
//     }

//     if (
//         AstUtils.isTConstant(center) &&
//         (ConjunctionConstants.includes(center.constantKind) || CloseWrapperConstants.includes(center.constantKind))
//     ) {
//         return {
//             leaf: XorNodeUtils.boxAst(left),
//             leafKind: ActiveNodeLeafKind.ContextNode,
//         };
//     }

//     throw new Error(JSON.stringify({ leftLeafKind: left.kind, centerLeafKind: center.kind }));
// }

interface LeafAndKind {
    readonly leaf: TXorNode;
    readonly leafKind: ActiveNodeLeafKind;
}

function discoverLeafKind(leaf: TLeaf, position: Position): ActiveNodeLeafKind {
    if (PositionUtils.isInAst(position, leaf, true, true)) {
        return ActiveNodeLeafKind.IsInAst;
    } else if (PositionUtils.isBeforeAst(position, leaf, false)) {
        return ActiveNodeLeafKind.IsBeforePosition;
    } else if (PositionUtils.isAfterAst(position, leaf, false)) {
        return ActiveNodeLeafKind.IsAfterPosition;
    } else {
        throw new CommonError.InvariantError(`somehow Position is not in, before, or after the AstNode.`);
    }
}

export function activeNode(nodeIdMapCollection: NodeIdMap.Collection, position: Position): TActiveNode {
    const astSearched: SearchedLeafs = leafSearch(nodeIdMapCollection, position);

    const { nodeClosestBeforePosition, nodeOnPosition, nodeClosestAfterPosition }: SearchedLeafs = leafSearch(
        nodeIdMapCollection,
        position,
    );

    const contextClosestOnOrAfterPosition: ParseContext.TNode | undefined = findContext(
        nodeIdMapCollection,
        astSearched,
    );

    let leaf: TXorNode | undefined;
    let leafKind: ActiveNodeLeafKind | undefined;

    // Case 1: empty document
    if (
        nodeClosestBeforePosition === undefined &&
        nodeOnPosition === undefined &&
        nodeClosestAfterPosition === undefined &&
        contextClosestOnOrAfterPosition === undefined
    ) {
        return createOutOfBoundPosition(position);
    }

    // Case 2: There's only 1 leaf

    // Case 2a: truthy left
    // `not |`
    // `x |`
    if (
        nodeClosestBeforePosition !== undefined &&
        nodeOnPosition === undefined &&
        nodeClosestAfterPosition === undefined
    ) {
        // With context
        // `not |`
        if (contextClosestOnOrAfterPosition !== undefined) {
            leaf = XorNodeUtils.boxContext(contextClosestOnOrAfterPosition);
            leafKind = ActiveNodeLeafKind.ContextNode;
        }
        // Without context
        // `x |`
        else {
            return createOutOfBoundPosition(position);
        }
    }
    // Case 2b: truthy center
    // `|not`
    // `|x`
    else if (
        nodeClosestBeforePosition === undefined &&
        nodeOnPosition !== undefined &&
        nodeClosestAfterPosition === undefined
    ) {
        // With or without context
        leaf = XorNodeUtils.boxAst(nodeOnPosition);
        leafKind = ActiveNodeLeafKind.IsInAst;
    }
    // Case 2c: truthy right
    // `| not`
    // `| 1`
    else if (
        nodeClosestBeforePosition === undefined &&
        nodeOnPosition === undefined &&
        nodeClosestAfterPosition !== undefined
    ) {
        // With or without context
        return createOutOfBoundPosition(position);
    }

    // Case 3: There's 2 leafs, left and center
    // `1+|1`
    // `if |true`
    // `{1, |} (will require drilldown)
    if (nodeClosestBeforePosition !== undefined && nodeOnPosition !== undefined) {
        // With or without context
        // `1+|1`
        // `if |true`
        leaf = XorNodeUtils.boxAst(nodeOnPosition);
        leafKind = ActiveNodeLeafKind.IsInAst;
    }

    // Case 4: There's 2 leafs, left and right (ie. between two nodes)
    if (nodeClosestBeforePosition !== undefined && nodeClosestAfterPosition !== undefined) {
        // `f|oo`
        leaf = XorNodeUtils.boxAst(nodeClosestAfterPosition);
        leafKind = ActiveNodeLeafKind.IsAfterPosition;
    }

    // Case 5: There's 2 leafs, center and right
    // `|not true
    if (nodeOnPosition !== undefined && nodeClosestAfterPosition !== undefined) {
        leaf = XorNodeUtils.boxAst(nodeOnPosition);
        leafKind = ActiveNodeLeafKind.IsInAst;
    }

    // Case 6: There's 3 leafs
    if (
        nodeClosestBeforePosition !== undefined &&
        nodeOnPosition !== undefined &&
        nodeClosestAfterPosition !== undefined
    ) {
        // `1|+1`
        if (
            nodeOnPosition.tokenRange.positionEnd.lineNumber === position.line &&
            nodeOnPosition.tokenRange.positionEnd.lineCodeUnit === position.character
        ) {
            leaf = XorNodeUtils.boxAst(nodeClosestBeforePosition);
            leafKind = ActiveNodeLeafKind.IsInAst;
        }
        // `1+|1`
        else if (
            AstUtils.isTConstant(nodeClosestBeforePosition) &&
            ShiftRightConstantKinds.includes(nodeClosestBeforePosition.constantKind)
        ) {
            leaf = XorNodeUtils.boxAst(nodeOnPosition);
            leafKind = ActiveNodeLeafKind.IsInAst;
        }
        // `not |true`
        else {
            leaf = XorNodeUtils.boxAst(nodeClosestBeforePosition);
            leafKind = ActiveNodeLeafKind.IsBeforePosition;
        }
    }

    // // Case (3): There's nothing to the left of the position
    // if (nodeClosestBeforePosition === undefined) {
    //     // `|1+1`
    //     if (nodeOnPosition !== undefined) {
    //         leaf = XorNodeUtils.boxAst(nodeOnPosition);
    //         leafKind = ActiveNodeLeafKind.IsInAst;
    //     }
    //     // `| 1+1`
    //     else if (nodeClosestAfterPosition !== undefined) {
    //         leaf = XorNodeUtils.boxAst(nodeClosestAfterPosition);
    //         leafKind = ActiveNodeLeafKind.IsAfterPosition;
    //     }
    // }

    // // Case (4): Between 2 leafs
    // // `1 + | 1`
    // if (nodeClosestAfterPosition !== undefined && nodeClosestAfterPosition !== undefined) {
    //     leaf = XorNodeUtils.boxAst(nodeClosestAfterPosition);
    //     leafKind = ActiveNodeLeafKind.IsAfterPosition;
    // }

    // // If the left leaf is a conjunction, meaning we shift to the right.
    // if (
    //     nodeClosestBeforePosition !== undefined &&
    //     AstUtils.isTConstant(nodeClosestBeforePosition) &&
    //     ShiftRightConstantKinds.includes(nodeClosestBeforePosition.constantKind)
    // ) {
    //     // `1+|1
    //     if (nodeOnPosition !== undefined) {
    //         leaf = XorNodeUtils.boxAst(nodeOnPosition);
    //         leafKind = ActiveNodeLeafKind.IsInAst;
    //     }
    //     // `1 +| 1`
    //     else if (nodeClosestAfterPosition !== undefined) {
    //         leaf = XorNodeUtils.boxAst(nodeClosestAfterPosition);
    //         leafKind = ActiveNodeLeafKind.IsAfterPosition;
    //     }
    //     // `1 + |`
    //     else if (contextClosestOnOrAfterPosition !== undefined) {
    //         leaf = XorNodeUtils.boxContext(contextClosestOnOrAfterPosition);
    //         leafKind = ActiveNodeLeafKind.ContextNode;
    //     }
    // }

    // // If the center leaf is a conjunction, meaning we might shift to the left.
    // // `1|+`
    // // `1 |+`
    // if (
    //     nodeClosestBeforePosition !== undefined &&
    //     nodeOnPosition !== undefined &&
    //     AstUtils.isTConstant(nodeOnPosition) &&
    //     ShiftRightConstantKinds.includes(nodeOnPosition.constantKind)
    // ) {
    //     // `1|+`
    //     if (
    //         nodeOnPosition.tokenRange.positionEnd.lineNumber === position.line &&
    //         nodeOnPosition.tokenRange.positionEnd.lineCodeUnit === position.character
    //     ) {
    //         leaf = XorNodeUtils.boxAst(nodeClosestBeforePosition);
    //         leafKind = ActiveNodeLeafKind.IsInAst;
    //     } else {
    //         leaf = XorNodeUtils.boxAst(nodeOnPosition);
    //         leafKind = ActiveNodeLeafKind.IsInAst;
    //     }
    // }

    // if (
    //     nodeOnPosition !== undefined &&
    //     AstUtils.isTConstant(nodeOnPosition) &&
    //     CloseWrapperConstants.includes(nodeOnPosition.constantKind) &&
    //     nodeClosestBeforePosition
    // ) {
    //     // `(1+1|)`
    //     if (
    //         nodeClosestBeforePosition.tokenRange.positionEnd.lineNumber === position.line &&
    //         nodeClosestBeforePosition.tokenRange.positionEnd.lineCodeUnit === position.character
    //     ) {
    //         leaf = XorNodeUtils.boxAst(nodeClosestBeforePosition);
    //         leafKind = ActiveNodeLeafKind.IsInAst;
    //     }
    //     // `(1+1 |)`
    //     else {
    //         leaf = XorNodeUtils.boxAst(nodeOnPosition);
    //         leafKind = ActiveNodeLeafKind.IsInAst;
    //     }
    // }

    if (leaf === undefined || leafKind === undefined) {
        throw new Error();
    }

    //     // `foo(1|`
    //     if (
    //         nodeOnPosition === undefined &&
    //         nodeClosestAfterPosition === undefined &&
    //         contextClosestOnOrAfterPosition !== undefined
    //     ) {
    //         leaf = XorNodeUtils.boxContext(contextClosestOnOrAfterPosition);
    //         leafKind = ActiveNodeLeafKind.ContextNode;
    //     } else if (
    //         AstUtils.isTConstant(nodeClosestBeforePosition) &&
    //         ShiftRightConstantKinds.includes(nodeClosestBeforePosition.constantKind)
    //     ) {
    //         // `1 +|2`
    //         if (nodeOnPosition !== undefined) {
    //             leaf = XorNodeUtils.boxAst(nodeOnPosition);
    //             leafKind = ActiveNodeLeafKind.ContextNode;
    //         }
    //         // `1 +| 2`
    //         else if (nodeClosestAfterPosition !== undefined) {
    //             leaf = XorNodeUtils.boxAst(nodeClosestAfterPosition);
    //             leafKind = ActiveNodeLeafKind.ContextNode;
    //         }
    //         // `1 + |`
    //         else if (contextClosestOnOrAfterPosition !== undefined) {
    //             leaf = XorNodeUtils.boxContext(contextClosestOnOrAfterPosition);
    //             leafKind = ActiveNodeLeafKind.ContextNode;
    //         } else {
    //             return createOutOfBoundPosition(position);
    //         }
    //     }
    // }

    // // eg. `let x|=1 in x`
    // if (
    //     // If a node ends directly at the Position's start
    //     // and there's a node which start exactly at the Position's end
    //     // ie. overlapping stard/end
    //     // eg. `let x|=1 in x`
    //     nodeClosestBeforePosition !== undefined &&
    //     nodeOnPosition !== undefined &&
    //     nodeClosestBeforePosition.tokenRange.positionEnd.codeUnit === nodeOnPosition.tokenRange.positionStart.codeUnit
    // ) {
    //     const picked: LeafAndKind = pickOverlappingLeftOrCenterLeaf(
    //         nodeClosestBeforePosition,
    //         nodeOnPosition,
    //         nodeClosestAfterPosition,
    //     );

    //     leaf = picked.leaf;
    //     leafKind = picked.leafKind;
    // }

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
        isInKey: isInKey(ancestry),
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

interface SearchedLeafs {
    readonly nodeClosestBeforePosition: TLeaf | undefined;
    readonly nodeOnPosition: TLeaf | undefined;
    readonly nodeClosestAfterPosition: TLeaf | undefined;
}

function isAnchorNode(position: Position, astNode: TLeaf): boolean {
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

function leafSearch(nodeIdMapCollection: NodeIdMap.Collection, position: Position): SearchedLeafs {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;

    let nodeOnPosition: TLeaf | undefined;
    let nodeClosestBeforePosition: TLeaf | undefined;
    let nodeClosestAfterPosition: TLeaf | undefined;

    // Find the closest leaf on or to the left of the position.
    for (const nodeId of nodeIdMapCollection.leafIds) {
        const candidate: Ast.TNode | undefined = astNodeById.get(nodeId);

        Assert.isDefined(candidate, `leafIds contained a value that wasn't found in astNodeById`, { nodeId });
        assertIsLeaf(candidate);

        // This shouldn't occur, but safety first.
        if (candidate === undefined) {
            continue;
        }

        // If the candidate starts under the cursor position then it's safe to assume it's the best candidate,
        // as each leaf node is guaranteed to be non-overlapping.
        if (PositionUtils.isOnAstStart(position, candidate)) {
            nodeOnPosition = candidate;
        }
        // Else if the candidate is before the cursor position
        else if (PositionUtils.isAfterAst(position, candidate, false)) {
            // And we either haven't found a closestNodeOnOrBeforePosition yet, or if the candidate is better (more right) than the current closestNodeOnOrBeforePosition.
            if (
                nodeClosestBeforePosition === undefined ||
                nodeClosestBeforePosition.tokenRange.tokenIndexStart < candidate.tokenRange.tokenIndexStart
            ) {
                nodeClosestBeforePosition = candidate;
            }
        }
        // Else the candidate must be after the cursor position.
        // And we either haven't found a closestAfterPosition yet, or if the candidate is better (more left) than the current nodeClosestAfterPosition.
        else if (
            nodeClosestAfterPosition === undefined ||
            nodeClosestAfterPosition.tokenRange.tokenIndexStart > candidate.tokenRange.tokenIndexStart
        ) {
            nodeClosestAfterPosition = candidate;
        }
    }

    return {
        nodeClosestBeforePosition,
        nodeOnPosition,
        nodeClosestAfterPosition,
    };
}

function findContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    searchedLeafs: SearchedLeafs,
): ParseContext.TNode | undefined {
    const tokenIndexLowBound: number | undefined =
        searchedLeafs.nodeClosestAfterPosition?.tokenRange.tokenIndexStart ??
        searchedLeafs.nodeOnPosition?.tokenRange.tokenIndexStart ??
        searchedLeafs.nodeClosestBeforePosition?.tokenRange.tokenIndexStart;

    if (tokenIndexLowBound === undefined) {
        return undefined;
    }

    let closestContextOnOrAfterPosition: ParseContext.TNode | undefined = undefined;

    for (const candidate of nodeIdMapCollection.contextNodeById.values()) {
        if (candidate.tokenStart) {
            if (candidate.tokenIndexStart < tokenIndexLowBound) {
                continue;
            }

            // A higher id means it's deeper in the AST.
            if (closestContextOnOrAfterPosition === undefined || closestContextOnOrAfterPosition.id < candidate.id) {
                closestContextOnOrAfterPosition = candidate;
            }
        }
    }

    return closestContextOnOrAfterPosition;
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
            identifier = leaf;
        } else {
            const parent: Ast.TNode | undefined = NodeIdMapUtils.unboxIfAst(nodeIdMapCollection, parentId);

            if (parent?.kind === Ast.NodeKind.IdentifierPairedExpression) {
                identifier = leaf;
            } else if (parent?.kind === Ast.NodeKind.IdentifierExpression) {
                identifier = parent;
            } else {
                identifier = leaf;
            }
        }
    }
    // If '@', then check if it's part of an IdentifierExpression.
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
                normalizedLiteral,
                normalizedRecursiveLiteral: identifier.inclusiveConstant ? `@${normalizedLiteral}` : undefined,
            };

            break;
        }

        default:
            throw Assert.isNever(identifier);
    }

    return result;
}

function isInKey(ancestry: ReadonlyArray<TXorNode>): boolean {
    if (ancestry.length < 2) {
        return false;
    }

    const child: TXorNode = ArrayUtils.assertGet(ancestry, 0);
    const parent: TXorNode = ArrayUtils.assertGet(ancestry, 1);

    // Return true if we're in the key portion of a key-value pair.
    return (
        [
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.IdentifierPairedExpression,
        ].includes(parent.node.kind) && child.node.attributeIndex === 0
    );
}

type TLeaf = Ast.GeneralizedIdentifier | Ast.Identifier | Ast.LiteralExpression | Ast.PrimitiveType | Ast.TConstant;

function assertIsLeaf(node: Ast.TNode): asserts node is TLeaf {
    Assert.isTrue(node.isLeaf, "Assert(node.isLeaf)", { nodeId: node.id, nodeKind: node.kind });
}
