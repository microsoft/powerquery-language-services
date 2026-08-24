// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { dereferencedIdentifierType } from "./common";
import { InspectTypeState } from "./inspectTypeState";
import { intrinsicIdentifierType } from "./inspectTypeIntrinsic";

export async function inspectTypeIdentifierExpression(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.TPowerQueryType> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeIdentifierExpression.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.IdentifierExpression>(xorNode, Ast.NodeKind.IdentifierExpression);

    let result: Type.TPowerQueryType;

    if (XorNodeUtils.isContext(xorNode)) {
        result = Type.UnknownInstance;
    } else {
        let dereferencedType: Type.TPowerQueryType | undefined = await dereferencedIdentifierType(
            state,
            xorNode,
            trace.id,
        );

        // If the dereferenced type is unknown, we will attempt to see if the identifier is an intrinsic function.
        if (dereferencedType?.kind === Type.TypeKind.Unknown) {
            dereferencedType = intrinsicIdentifierType(xorNode.node.identifier.literal);
        }

        result = dereferencedType ?? Type.UnknownInstance;
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}
