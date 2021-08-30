// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeNullCoalescingExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const maybeLeftType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    const maybeNullCoalescingOperator: Ast.TConstant | undefined = NodeIdMapUtils.maybeUnboxNthChildIfAstChecked(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        Ast.NodeKind.Constant,
    );
    // '??' isn't present, treat it as an Expression.
    if (maybeNullCoalescingOperator === undefined) {
        return maybeLeftType;
    }

    const maybeRightType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
    if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return Type.NoneInstance;
    }

    return TypeUtils.createAnyUnion([maybeLeftType, maybeRightType]);
}
