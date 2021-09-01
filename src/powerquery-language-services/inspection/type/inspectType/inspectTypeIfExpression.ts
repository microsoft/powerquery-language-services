// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeIfExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.IfExpression>(xorNode, Ast.NodeKind.IfExpression);

    const conditionType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);
    if (conditionType.kind === Type.TypeKind.Unknown) {
        return Type.UnknownInstance;
    }
    // Any is allowed so long as AnyUnion only contains Any or Logical.
    else if (conditionType.kind === Type.TypeKind.Any) {
        if (
            conditionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
            !allForAnyUnion(
                conditionType,
                (type: Type.TPowerQueryType) => type.kind === Type.TypeKind.Logical || type.kind === Type.TypeKind.Any,
            )
        ) {
            return Type.NoneInstance;
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        return Type.NoneInstance;
    }

    const trueExprType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 5);

    return TypeUtils.createAnyUnion([trueExprType, falseExprType]);
}
