// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeRecord<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    state: InspectTypeState<S>,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.DefinedRecord {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    PQP.Parser.XorNodeUtils.assertIsRecord(xorNode);

    const fields: Map<string, PQP.Language.Type.TPowerQueryType> = new Map();
    for (const keyValuePair of PQP.Parser.NodeIdMapIterator.iterRecord(state.nodeIdMapCollection, xorNode)) {
        if (keyValuePair.maybeValue) {
            fields.set(keyValuePair.keyLiteral, inspectXor(state, keyValuePair.maybeValue));
        } else {
            fields.set(keyValuePair.keyLiteral, PQP.Language.Type.UnknownInstance);
        }
    }

    return {
        kind: PQP.Language.Type.TypeKind.Record,
        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.DefinedRecord,
        isNullable: false,
        fields,
        isOpen: false,
    };
}
