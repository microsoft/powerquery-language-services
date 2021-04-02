// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeNullCoalescingExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.NullCoalescingExpression);

    const maybeLeftType: PQP.Language.Type.PowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    const maybeNullCoalescingOperator:
        | PQP.Language.Ast.TNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        [PQP.Language.Ast.NodeKind.Constant],
    );
    // '??' isn't present, treat it as an Expression.
    if (maybeNullCoalescingOperator === undefined) {
        return maybeLeftType;
    }

    const maybeRightType: PQP.Language.Type.PowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
    if (
        maybeLeftType.kind === PQP.Language.Type.TypeKind.None ||
        maybeRightType.kind === PQP.Language.Type.TypeKind.None
    ) {
        return PQP.Language.Type.NoneInstance;
    }

    return PQP.Language.TypeUtils.createAnyUnion([maybeLeftType, maybeRightType]);
}
