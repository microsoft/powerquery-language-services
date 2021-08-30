// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { XorNodeUtils } from "../../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";

export function inspectTypeErrorHandlingExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.ErrorHandlingExpression);

    const maybeOtherwiseExpression:
        | PQP.Parser.XorNode<PQP.Language.Ast.OtherwiseExpression>
        | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChildChecked<PQP.Language.Ast.OtherwiseExpression>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
        PQP.Language.Ast.NodeKind.OtherwiseExpression,
    );

    return PQP.Language.TypeUtils.createAnyUnion([
        inspectTypeFromChildAttributeIndex(state, xorNode, 1),
        maybeOtherwiseExpression !== undefined
            ? inspectXor(state, maybeOtherwiseExpression)
            : PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Record),
    ]);
}
