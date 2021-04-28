// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeParameter<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.Parameter);

    const maybeOptionalConstant:
        | PQP.Language.Ast.TNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeChildAstByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        [PQP.Language.Ast.NodeKind.Constant],
    );

    const maybeParameterType:
        | PQP.Language.Type.TPowerQueryType
        | undefined = PQP.Language.TypeUtils.assertAsTPrimitiveType(
        inspectTypeFromChildAttributeIndex(state, xorNode, 2),
    );

    return {
        ...maybeParameterType,
        isNullable: maybeOptionalConstant !== undefined || maybeParameterType.isNullable,
    };
}
