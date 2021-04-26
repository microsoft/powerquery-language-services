// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeEachExpression<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertAstNodeKind(xorNode, PQP.Language.Ast.NodeKind.EachExpression);

    const expressionType: PQP.Language.Type.PowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);

    return PQP.Language.TypeUtils.createDefinedFunction(
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
