// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";

export function inspectTypeErrorHandlingExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.ErrorHandlingExpression>(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    const maybeOtherwiseExpression: XorNode<Ast.OtherwiseExpression> | undefined =
        NodeIdMapUtils.maybeNthChildChecked<Ast.OtherwiseExpression>(
            state.nodeIdMapCollection,
            xorNode.node.id,
            2,
            Ast.NodeKind.OtherwiseExpression,
        );

    return TypeUtils.createAnyUnion([
        inspectTypeFromChildAttributeIndex(state, xorNode, 1),
        maybeOtherwiseExpression !== undefined
            ? inspectXor(state, maybeOtherwiseExpression)
            : TypeUtils.createPrimitiveType(false, Type.TypeKind.Record),
    ]);
}
