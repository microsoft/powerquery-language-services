// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeEachExpression(
    state: InspectTypeState,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.EachExpression);

    const expressionType: PQP.Language.Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);

    return PQP.Language.TypeUtils.definedFunctionFactory(
        false,
        [
            {
                isNullable: false,
                isOptional: false,
                maybeType: PQP.Language.Type.TypeKind.Any,
                nameLiteral: "_",
            },
        ],
        expressionType,
    );
}
