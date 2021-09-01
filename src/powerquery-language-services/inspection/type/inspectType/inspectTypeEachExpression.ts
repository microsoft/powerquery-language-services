// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeEachExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.EachExpression>(xorNode, Ast.NodeKind.EachExpression);

    const expressionType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);

    return TypeUtils.createDefinedFunction(
        false,
        [
            {
                isNullable: false,
                isOptional: false,
                maybeType: Type.TypeKind.Any,
                nameLiteral: "_",
            },
        ],
        expressionType,
    );
}
