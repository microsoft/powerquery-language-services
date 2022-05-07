// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectTypeState, inspectXor } from "./common";
import { LanguageServiceTraceConstant, TraceUtils } from "../../..";

export async function inspectTypeRecord(
    state: InspectTypeState,
    xorNode: TXorNode,
    maybeCorrelationId: number | undefined,
): Promise<Type.DefinedRecord> {
    const trace: Trace = state.traceManager.entry(
        LanguageServiceTraceConstant.Type,
        inspectTypeRecord.name,
        maybeCorrelationId,
        TraceUtils.createXorNodeDetails(xorNode),
    );

    state.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsRecord(xorNode);

    const fields: Map<string, Type.TPowerQueryType> = new Map();

    for (const keyValuePair of NodeIdMapIterator.iterRecord(state.nodeIdMapCollection, xorNode)) {
        if (keyValuePair.maybeValue) {
            // eslint-disable-next-line no-await-in-loop
            fields.set(keyValuePair.keyLiteral, await inspectXor(state, keyValuePair.maybeValue, trace.id));
        } else {
            fields.set(keyValuePair.keyLiteral, Type.UnknownInstance);
        }
    }

    const result: Type.TPowerQueryType = {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable: false,
        fields,
        isOpen: false,
    };

    trace.exit({ [TraceConstant.Result]: TraceUtils.createTypeDetails(result) });

    return result;
}
