// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export async function inspectTypeParameter(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeParameter.name,
        correlationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.TParameter>(xorNode, Ast.NodeKind.Parameter);

    const maybeOptionalConstant: Ast.TConstant | undefined = NodeIdMapUtils.unboxNthChildIfAstChecked<Ast.TConstant>(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        Ast.NodeKind.Constant,
    );

    const maybeParameterType: Type.TPowerQueryType | undefined = TypeUtils.assertAsTPrimitiveType(
        await inspectTypeFromChildAttributeIndex(state, xorNode, 2, trace.id),
    );

    const result: Type.TPowerQueryType = {
        ...maybeParameterType,
        isNullable: maybeOptionalConstant !== undefined || maybeParameterType.isNullable,
    };

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
