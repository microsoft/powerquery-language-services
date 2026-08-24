// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Keyword, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeHashTableInvokeExpression } from "./inspectTypeHashTableInvokeExpression";
import { InspectTypeState } from "./inspectTypeState";

const FunctionIntrinsicIdentifiers: ReadonlySet<string> = new Set([
    Keyword.KeywordKind.HashBinary,
    Keyword.KeywordKind.HashDate,
    Keyword.KeywordKind.HashDateTime,
    Keyword.KeywordKind.HashDateTimeZone,
    Keyword.KeywordKind.HashDuration,
    Keyword.KeywordKind.HashTable,
    Keyword.KeywordKind.HashTime,
]);

export function intrinsicIdentifierType(identifierLiteral: string): Type.TPowerQueryType | undefined {
    return FunctionIntrinsicIdentifiers.has(identifierLiteral) ? Type.FunctionInstance : undefined;
}

export async function tryInspectTypeIntrinsicInvokeExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType | undefined> {
    const identifier: XorNode<Ast.IdentifierExpression> | undefined = NodeIdMapUtils.invokeExpressionIdentifier(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );

    if (identifier === undefined || XorNodeUtils.isContext(identifier)) {
        return undefined;
    }

    switch (identifier.node.identifier.literal) {
        case Keyword.KeywordKind.HashTable:
            return await inspectTypeHashTableInvokeExpression(state, xorNode, correlationId);

        default:
            return undefined;
    }
}
