// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Assert } from "@microsoft/powerquery-parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectionTraceConstant, TraceUtils } from "../../..";
import { InspectTypeState, inspectXor } from "./common";
import { TypeStrategy } from "../../../inspectionSettings";

export async function inspectTypeRecord(
    state: InspectTypeState,
    xorNode: TXorNode,
    correlationId: number | undefined,
): Promise<Type.Record | Type.DefinedRecord> {
    const trace: Trace = state.traceManager.entry(
        InspectionTraceConstant.InspectType,
        inspectTypeRecord.name,
        correlationId,
        TraceUtils.xorNodeDetails(xorNode),
    );

    state.cancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsRecord(xorNode);
    let result: Type.Record | Type.DefinedRecord;

    switch (state.typeStrategy) {
        case TypeStrategy.Extended: {
            const fields: Map<string, Type.TPowerQueryType> = new Map();

            for (const keyValuePair of NodeIdMapIterator.iterRecord(state.nodeIdMapCollection, xorNode)) {
                if (keyValuePair.value) {
                    fields.set(
                        keyValuePair.normalizedKeyLiteral,
                        // eslint-disable-next-line no-await-in-loop
                        await inspectXor(state, keyValuePair.value, trace.id),
                    );
                } else {
                    fields.set(keyValuePair.keyLiteral, Type.UnknownInstance);
                }
            }

            result = {
                kind: Type.TypeKind.Record,
                extendedKind: Type.ExtendedTypeKind.DefinedRecord,
                isNullable: false,
                fields,
                isOpen: false,
            };

            break;
        }

        case TypeStrategy.Primitive:
            result = Type.RecordInstance;
            break;

        default:
            throw Assert.isNever(state.typeStrategy);
    }

    trace.exit({ [TraceConstant.Result]: TraceUtils.typeDetails(result) });

    return result;
}
