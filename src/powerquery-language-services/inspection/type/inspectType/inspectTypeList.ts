// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeList(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.List | Type.DefinedList> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeList.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    let result: Type.List | Type.DefinedList;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            state.cancellationToken?.throwIfCancelled();
            const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterListItems(state.nodeIdMapCollection, xorNode);

            const elements: ReadonlyArray<Type.TPowerQueryType> = await Promise.all(
                items.map((item: TXorNode) => inspectXor(state, item, trace.id)),
            );

            result = {
                kind: Type.TypeKind.List,
                isNullable: false,
                extendedKind: Type.ExtendedTypeKind.DefinedList,
                elements,
            };

            break;
        }

        case TypeStrategy.Primitive:
            result = Type.ListInstance;
            break;

        default:
            Assert.isNever(state.typeStrategy);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}
