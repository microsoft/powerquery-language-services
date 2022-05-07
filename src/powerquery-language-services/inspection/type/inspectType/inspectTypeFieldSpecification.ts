// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeFieldSpecification(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeFieldSpecification.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.FieldSpecification>(xorNode, Ast.NodeKind.FieldSpecification);

    const maybeFieldTypeSpecification: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
    );

    const result: Type.TPowerQueryType =
        maybeFieldTypeSpecification !== undefined
            ? await inspectXor(state, maybeFieldTypeSpecification, trace.id)
            : Type.AnyInstance;

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
