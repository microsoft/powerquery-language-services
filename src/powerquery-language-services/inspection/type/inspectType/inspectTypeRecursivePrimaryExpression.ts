// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { XorNodeUtils } from "../../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXor } from "./common";

export function inspectTypeRecursivePrimaryExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.RecursivePrimaryExpression);

    const maybeHead: PQP.Parser.TXorNode | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
    );
    if (maybeHead === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    const headType: PQP.Language.Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    if (headType.kind === PQP.Language.Type.TypeKind.None || headType.kind === PQP.Language.Type.TypeKind.Unknown) {
        return headType;
    }

    const maybeArrayWrapper:
        | PQP.Parser.XorNode<PQP.Language.Ast.TArrayWrapper>
        | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChildChecked<PQP.Language.Ast.TArrayWrapper>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        PQP.Language.Ast.NodeKind.ArrayWrapper,
    );
    if (maybeArrayWrapper === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    const maybeExpressions:
        | ReadonlyArray<PQP.Parser.TXorNode>
        | undefined = PQP.Parser.NodeIdMapIterator.assertIterChildrenXor(
        state.nodeIdMapCollection,
        maybeArrayWrapper.node.id,
    );
    if (maybeExpressions === undefined) {
        return PQP.Language.Type.UnknownInstance;
    }

    let leftType: PQP.Language.Type.TPowerQueryType = headType;
    for (const right of maybeExpressions) {
        const rightType: PQP.Language.Type.TPowerQueryType = inspectXor(state, right);
        leftType = rightType;
    }

    return leftType;
}
