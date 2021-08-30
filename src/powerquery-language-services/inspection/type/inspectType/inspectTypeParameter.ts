// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { XorNodeUtils } from "../../../../../../powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeParameter(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, PQP.Language.Ast.NodeKind.Parameter);

    const maybeOptionalConstant:
        | PQP.Language.Ast.TConstant
        | undefined = PQP.Parser.NodeIdMapUtils.maybeUnwrapNthChildIfAstChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        PQP.Language.Ast.NodeKind.Constant,
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
