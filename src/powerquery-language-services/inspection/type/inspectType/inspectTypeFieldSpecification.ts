// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeFieldSpecification<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.FieldSpecification);

    const maybeFieldTypeSpecification:
        | PQP.Parser.TXorNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
        undefined,
    );

    return maybeFieldTypeSpecification !== undefined
        ? inspectXor(state, maybeFieldTypeSpecification)
        : PQP.Language.Type.AnyInstance;
}
