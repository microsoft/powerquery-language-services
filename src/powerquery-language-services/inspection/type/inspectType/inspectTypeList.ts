// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";

export async function inspectTypeList(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.DefinedList> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeList.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterListItems(state.nodeIdMapCollection, xorNode);

    const elements: ReadonlyArray<Type.TPowerQueryType> = await Promise.all(
        items.map((item: TXorNode) => inspectXor(state, item, trace.id)),
    );

    const result: Type.TPowerQueryType = {
        kind: Type.TypeKind.List,
        isNullable: false,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        elements,
    };

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
