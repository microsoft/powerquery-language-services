// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { allForAnyUnion, inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeIfExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PqType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.IfExpression);

    const conditionType: PQP.Language.Type.PqType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);
    if (conditionType.kind === PQP.Language.Type.TypeKind.Unknown) {
        return PQP.Language.Type.UnknownInstance;
    }
    // Any is allowed so long as AnyUnion only contains Any or Logical.
    else if (conditionType.kind === PQP.Language.Type.TypeKind.Any) {
        if (
            conditionType.maybeExtendedKind === PQP.Language.Type.ExtendedTypeKind.AnyUnion &&
            !allForAnyUnion(
                conditionType,
                (type: PQP.Language.Type.PqType) =>
                    type.kind === PQP.Language.Type.TypeKind.Logical || type.kind === PQP.Language.Type.TypeKind.Any,
            )
        ) {
            return PQP.Language.Type.NoneInstance;
        }
    } else if (conditionType.kind !== PQP.Language.Type.TypeKind.Logical) {
        return PQP.Language.Type.NoneInstance;
    }

    const trueExprType: PQP.Language.Type.PqType = inspectTypeFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: PQP.Language.Type.PqType = inspectTypeFromChildAttributeIndex(state, xorNode, 5);

    return PQP.Language.TypeUtils.anyUnionFactory([trueExprType, falseExprType]);
}
