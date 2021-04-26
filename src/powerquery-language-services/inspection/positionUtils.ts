// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position } from "vscode-languageserver-types";

export function isBeforeXor(position: Position, xorNode: PQP.Parser.TXorNode, isBoundIncluded: boolean): boolean {
    switch (xorNode.kind) {
        case PQP.Parser.XorNodeKind.Ast:
            return isBeforeAst(position, xorNode.node, isBoundIncluded);

        case PQP.Parser.XorNodeKind.Context:
            return isBeforeContext(position, xorNode.node, isBoundIncluded);

        default:
            throw PQP.Assert.isNever(xorNode);
    }
}

export function isInXor(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    xorNode: PQP.Parser.TXorNode,
    isLowerBoundIncluded: boolean,
    isUpperBoundIncluded: boolean,
): boolean {
    switch (xorNode.kind) {
        case PQP.Parser.XorNodeKind.Ast:
            return isInAst(position, xorNode.node, isLowerBoundIncluded, isUpperBoundIncluded);

        case PQP.Parser.XorNodeKind.Context:
            return isInContext(nodeIdMapCollection, position, xorNode.node, isLowerBoundIncluded, isUpperBoundIncluded);

        default:
            throw PQP.Assert.isNever(xorNode);
    }
}

export function isOnXorStart(position: Position, xorNode: PQP.Parser.TXorNode): boolean {
    switch (xorNode.kind) {
        case PQP.Parser.XorNodeKind.Ast:
            return isOnAstStart(position, xorNode.node);

        case PQP.Parser.XorNodeKind.Context:
            return isOnContextStart(position, xorNode.node);

        default:
            throw PQP.Assert.isNever(xorNode);
    }
}

export function isOnXorEnd(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    xorNode: PQP.Parser.TXorNode,
): boolean {
    switch (xorNode.kind) {
        case PQP.Parser.XorNodeKind.Ast:
            return isOnAstEnd(position, xorNode.node);

        case PQP.Parser.XorNodeKind.Context:
            return isOnContextEnd(nodeIdMapCollection, position, xorNode.node);

        default:
            throw PQP.Assert.isNever(xorNode);
    }
}

export function isAfterXor(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    xorNode: PQP.Parser.TXorNode,
    isBoundIncluded: boolean,
): boolean {
    switch (xorNode.kind) {
        case PQP.Parser.XorNodeKind.Ast:
            return isAfterAst(position, xorNode.node, isBoundIncluded);

        case PQP.Parser.XorNodeKind.Context:
            return isAfterContext(nodeIdMapCollection, position, xorNode.node, isBoundIncluded);

        default:
            throw PQP.Assert.isNever(xorNode);
    }
}

export function isBeforeContext(
    position: Position,
    contextNode: PQP.Parser.ParseContext.Node,
    isBoundIncluded: boolean,
): boolean {
    const maybeTokenStart: PQP.Language.Token.Token | undefined = contextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        return false;
    }
    const tokenStart: PQP.Language.Token.Token = maybeTokenStart;

    return isBeforeTokenPosition(position, tokenStart.positionStart, isBoundIncluded);
}

export function isInContext(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    contextNode: PQP.Parser.ParseContext.Node,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeContext(position, contextNode, isLowerBoundIncluded) &&
        !isAfterContext(nodeIdMapCollection, position, contextNode, isHigherBoundIncluded)
    );
}

export function isOnContextStart(position: Position, contextNode: PQP.Parser.ParseContext.Node): boolean {
    return contextNode.maybeTokenStart !== undefined
        ? isOnTokenPosition(position, contextNode.maybeTokenStart.positionStart)
        : false;
}

export function isOnContextEnd(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    contextNode: PQP.Parser.ParseContext.Node,
): boolean {
    const maybeLeaf: PQP.Language.Ast.TNode | undefined = PQP.Parser.NodeIdMapUtils.maybeRightMostLeaf(
        nodeIdMapCollection,
        contextNode.id,
    );
    if (maybeLeaf === undefined) {
        return false;
    }

    return isOnAstEnd(position, maybeLeaf);
}

export function isAfterContext(
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
    contextNode: PQP.Parser.ParseContext.Node,
    isBoundIncluded: boolean,
): boolean {
    const maybeLeaf: PQP.Language.Ast.TNode | undefined = PQP.Parser.NodeIdMapUtils.maybeRightMostLeaf(
        nodeIdMapCollection,
        contextNode.id,
    );
    if (maybeLeaf === undefined) {
        // We're assuming position is a valid range for the document.
        // Therefore if the context node didn't have a token (caused by EOF) we can make this assumption.
        if (contextNode.maybeTokenStart === undefined) {
            return false;
        } else {
            return isAfterTokenPosition(position, contextNode.maybeTokenStart.positionEnd, isBoundIncluded);
        }
    }
    const leaf: PQP.Language.Ast.TNode = maybeLeaf;

    return isAfterAst(position, leaf, isBoundIncluded);
}

export function isBeforeAst(position: Position, astNode: PQP.Language.Ast.TNode, isBoundIncluded: boolean): boolean {
    return isBeforeTokenPosition(position, astNode.tokenRange.positionStart, isBoundIncluded);
}

export function isInAst(
    position: Position,
    astNode: PQP.Language.Ast.TNode,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeAst(position, astNode, isLowerBoundIncluded) && !isAfterAst(position, astNode, isHigherBoundIncluded)
    );
}

export function isOnAstStart(position: Position, astNode: PQP.Language.Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isOnAstEnd(position: Position, astNode: PQP.Language.Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isAfterAst(position: Position, astNode: PQP.Language.Ast.TNode, isBoundIncluded: boolean): boolean {
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
