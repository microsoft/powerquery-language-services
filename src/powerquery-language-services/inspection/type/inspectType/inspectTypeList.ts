// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeList(state: InspectTypeState, xorNode: TXorNode): Promise<Type.DefinedList> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeList.name,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterListItems(state.nodeIdMapCollection, xorNode);

    const elements: ReadonlyArray<Type.TPowerQueryType> = await Promise.all(
        items.map((item: TXorNode) => inspectXor(state, item)),
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
