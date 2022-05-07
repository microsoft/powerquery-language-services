// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeListType(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.ListType | Type.Unknown> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeListType.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsNodeKind<Ast.ListType>(xorNode, Ast.NodeKind.ListType);

    const maybeListItem: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
    );

    let result: Type.TPowerQueryType;

    if (maybeListItem === undefined) {
        result = Type.UnknownInstance;
    } else {
        const itemType: Type.TPowerQueryType = await inspectXor(state, maybeListItem, trace.id);

        result = {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.ListType,
            isNullable: false,
            itemType,
        };
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
