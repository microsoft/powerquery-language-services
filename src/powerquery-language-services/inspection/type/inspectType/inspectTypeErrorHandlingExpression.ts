// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";

export function inspectTypeErrorHandlingExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.ErrorHandlingExpression);

    const maybeOtherwiseExpression:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
        [PQP.Language.Ast.NodeKind.OtherwiseExpression],
    );

    return PQP.Language.TypeUtils.anyUnionFactory([
        inspectTypeFromChildAttributeIndex(state, xorNode, 1),
        maybeOtherwiseExpression !== undefined
            ? inspectXor(state, maybeOtherwiseExpression)
            : PQP.Language.TypeUtils.primitiveTypeFactory(false, PQP.Language.Type.TypeKind.Record),
    ]);
}
