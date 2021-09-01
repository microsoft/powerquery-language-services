// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeRecord(state: InspectTypeState, xorNode: TXorNode): Type.DefinedRecord {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertIsRecord(xorNode);

    const fields: Map<string, Type.TPowerQueryType> = new Map();
    for (const keyValuePair of NodeIdMapIterator.iterRecord(state.nodeIdMapCollection, xorNode)) {
        if (keyValuePair.maybeValue) {
            fields.set(keyValuePair.keyLiteral, inspectXor(state, keyValuePair.maybeValue));
        } else {
            fields.set(keyValuePair.keyLiteral, Type.UnknownInstance);
        }
    }

    return {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable: false,
        fields,
        isOpen: false,
    };
}
