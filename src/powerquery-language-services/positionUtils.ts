// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
    XorNodeKind,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Position, Range } from "vscode-languageserver-types";
import { Assert } from "@microsoft/powerquery-parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export function createPositionFromTokenPosition(tokenPosition: PQP.Language.Token.TokenPosition): Position {
    return {
        line: tokenPosition.lineNumber,
        character: tokenPosition.lineCodeUnit,
    };
}

// Attempts to turn a TXorNode into a Range.
// Returns undefined if there are no leafs nodes.
export async function rangeFromXorNode(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
): Promise<Range | undefined> {
    const nodeId: number = xorNode.node.id;
    const leftMostLeaf: Ast.TNode | undefined = NodeIdMapUtils.leftMostLeaf(nodeIdMapCollection, nodeId);

    const rightMostLeaf: Ast.TNode | undefined = await NodeIdMapUtils.rightMostLeaf(nodeIdMapCollection, nodeId);

    return Promise.resolve(
        leftMostLeaf === undefined || rightMostLeaf === undefined
            ? undefined
            : createRangeFromTokenPositions(
                  leftMostLeaf.tokenRange.positionStart,
                  rightMostLeaf.tokenRange.positionEnd,
              ),
    );
}

export function createRangeFromTokenPositions(
    startTokenPosition: PQP.Language.Token.TokenPosition | undefined,
    endTokenPosition: PQP.Language.Token.TokenPosition | undefined,
): Range | undefined {
    if (startTokenPosition && endTokenPosition) {
        return {
            start: createPositionFromTokenPosition(startTokenPosition),
            end: createPositionFromTokenPosition(endTokenPosition),
        };
    }

    return undefined;
}

export function rangeFromTokenRange(tokenRange: PQP.Language.Token.TokenRange): Range {
    return createRangeFromTokenPositions(tokenRange.positionStart, tokenRange.positionEnd) as Range;
}

export function isBeforeXor(position: Position, xorNode: TXorNode, isBoundIncluded: boolean): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isBeforeAst(position, xorNode.node, isBoundIncluded);

        case XorNodeKind.Context:
            return isBeforeContext(position, xorNode.node, isBoundIncluded);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isInXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    xorNode: TXorNode,
    isLowerBoundIncluded: boolean,
    isUpperBoundIncluded: boolean,
): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isInAst(position, xorNode.node, isLowerBoundIncluded, isUpperBoundIncluded);

        case XorNodeKind.Context:
            return isInContext(nodeIdMapCollection, position, xorNode.node, isLowerBoundIncluded, isUpperBoundIncluded);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isOnXorStart(position: Position, xorNode: TXorNode): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isOnAstStart(position, xorNode.node);

        case XorNodeKind.Context:
            return isOnContextStart(position, xorNode.node);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isOnXorEnd(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    xorNode: TXorNode,
): Promise<boolean> {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return Promise.resolve(isOnAstEnd(position, xorNode.node));

        case XorNodeKind.Context:
            return isOnContextEnd(nodeIdMapCollection, position, xorNode.node);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isAfterXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    xorNode: TXorNode,
    isBoundIncluded: boolean,
): Promise<boolean> {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return Promise.resolve(isAfterAst(position, xorNode.node, isBoundIncluded));

        case XorNodeKind.Context:
            return isAfterContext(nodeIdMapCollection, position, xorNode.node, isBoundIncluded);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isBeforeContext(
    position: Position,
    contextNode: PQP.Parser.ParseContext.TNode,
    isBoundIncluded: boolean,
): boolean {
    const tokenStart: PQP.Language.Token.Token | undefined = contextNode.tokenStart;

    if (tokenStart === undefined) {
        return false;
    }

    return isBeforeTokenPosition(position, tokenStart.positionStart, isBoundIncluded);
}

export function isInContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: PQP.Parser.ParseContext.TNode,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeContext(position, contextNode, isLowerBoundIncluded) &&
        !isAfterContext(nodeIdMapCollection, position, contextNode, isHigherBoundIncluded)
    );
}

export function isOnContextStart(position: Position, contextNode: PQP.Parser.ParseContext.TNode): boolean {
    return contextNode.tokenStart !== undefined
        ? isOnTokenPosition(position, contextNode.tokenStart.positionStart)
        : false;
}

export async function isOnContextEnd(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: PQP.Parser.ParseContext.TNode,
): Promise<boolean> {
    const leaf: Ast.TNode | undefined = await NodeIdMapUtils.rightMostLeaf(nodeIdMapCollection, contextNode.id);

    if (leaf === undefined) {
        return Promise.resolve(false);
    }

    return Promise.resolve(isOnAstEnd(position, leaf));
}

export async function isAfterContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: PQP.Parser.ParseContext.TNode,
    isBoundIncluded: boolean,
): Promise<boolean> {
    const leaf: Ast.TNode | undefined = await NodeIdMapUtils.rightMostLeaf(nodeIdMapCollection, contextNode.id);

    if (leaf === undefined) {
        // We're assuming position is a valid range for the document.
        // Therefore if the context node didn't have a token (caused by EOF) we can make this assumption.
        if (contextNode.tokenStart === undefined) {
            return Promise.resolve(false);
        } else {
            return Promise.resolve(isAfterTokenPosition(position, contextNode.tokenStart.positionEnd, isBoundIncluded));
        }
    }

    return Promise.resolve(isAfterAst(position, leaf, isBoundIncluded));
}

export function isBeforeAst(position: Position, astNode: Ast.TNode, isBoundIncluded: boolean): boolean {
    return isBeforeTokenPosition(position, astNode.tokenRange.positionStart, isBoundIncluded);
}

export function isInAst(
    position: Position,
    astNode: Ast.TNode,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeAst(position, astNode, isLowerBoundIncluded) && !isAfterAst(position, astNode, isHigherBoundIncluded)
    );
}

export function isOnAstStart(position: Position, astNode: Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isOnAstEnd(position: Position, astNode: Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isAfterAst(position: Position, astNode: Ast.TNode, isBoundIncluded: boolean): boolean {
    return isAfterTokenPosition(position, astNode.tokenRange.positionEnd, isBoundIncluded);
}

export function isInToken(
    position: Position,
    token: PQP.Language.Token.Token,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeTokenPosition(position, token.positionStart, isLowerBoundIncluded) &&
        !isAfterTokenPosition(position, token.positionEnd, isHigherBoundIncluded)
    );
}

export function isBeforeTokenPosition(
    position: Position,
    tokenPosition: PQP.Language.Token.TokenPosition,
    isBoundIncluded: boolean,
): boolean {
    const positionLineNumber: number = position.line;

    if (positionLineNumber < tokenPosition.lineNumber) {
        return true;
    } else if (positionLineNumber > tokenPosition.lineNumber) {
        return false;
    } else {
        const upperBound: number = isBoundIncluded ? tokenPosition.lineCodeUnit : tokenPosition.lineCodeUnit + 1;

        return position.character < upperBound;
    }
}

export function isOnTokenPosition(position: Position, tokenPosition: PQP.Language.Token.TokenPosition): boolean {
    return position.line === tokenPosition.lineNumber && position.character === tokenPosition.lineCodeUnit;
}

export function isAfterTokenPosition(
    position: Position,
    tokenPosition: PQP.Language.Token.TokenPosition,
    isBoundIncluded: boolean,
): boolean {
    const positionLineNumber: number = position.line;

    if (positionLineNumber < tokenPosition.lineNumber) {
        return false;
    } else if (positionLineNumber > tokenPosition.lineNumber) {
        return true;
    } else {
        const upperBound: number = isBoundIncluded ? tokenPosition.lineCodeUnit : tokenPosition.lineCodeUnit - 1;

        return position.character > upperBound;
    }
}
