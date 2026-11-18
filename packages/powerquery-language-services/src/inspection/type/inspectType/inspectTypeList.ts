// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState } from "./inspectTypeState";
import { inspectXor } from "./common";
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

            // Ranges contribute a variable number of items, not a nested list element.
            if (items.some((item: TXorNode) => item.node.kind === Ast.NodeKind.RangeExpression)) {
                result = Type.ListInstance;
            } else {
                result = TypeUtils.definedList(
                    false,
                    await Promise.all(items.map((item: TXorNode) => inspectXor(state, item, trace.id))),
                );
            }

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
