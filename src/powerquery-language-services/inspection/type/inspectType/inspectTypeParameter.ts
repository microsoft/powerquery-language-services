// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeParameter(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TParameter>(xorNode, Ast.NodeKind.Parameter);

    const maybeOptionalConstant: Ast.TConstant | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        Ast.NodeKind.Constant,
    );

    const maybeParameterType: Type.TPowerQueryType | undefined = TypeUtils.assertAsTPrimitiveType(
        inspectTypeFromChildAttributeIndex(state, xorNode, 2),
    );

    return {
        ...maybeParameterType,
        isNullable: maybeOptionalConstant !== undefined || maybeParameterType.isNullable,
    };
}
