// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export function inspectTypeParameter(state: InspectTypeState, xorNode: TXorNode): Type.TPowerQueryType {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeParameter.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
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

    const result: Type.TPowerQueryType = {
        ...maybeParameterType,
        isNullable: maybeOptionalConstant !== undefined || maybeParameterType.isNullable,
    };

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
