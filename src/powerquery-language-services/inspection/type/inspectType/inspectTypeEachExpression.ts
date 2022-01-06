// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export function inspectTypeEachExpression(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeEachExpression.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.EachExpression>(xorNode, Ast.NodeKind.EachExpression);

    const expressionType: Type.TPowerQueryType = inspectTypeFromChildAttributeIndex(state, xorNode, 1);

    const result: Type.TPowerQueryType = TypeUtils.createDefinedFunction(
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

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
