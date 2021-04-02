// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeList(state: InspectTypeState, xorNode: PQP.Parser.TXorNode): PQP.Language.Type.DefinedList {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    const items: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.NodeIdMapIterator.iterListItems(
        state.nodeIdMapCollection,
        xorNode,
    );
    const elements: ReadonlyArray<PQP.Language.Type.PowerQueryType> = items.map((item: PQP.Parser.TXorNode) =>
        inspectXor(state, item),
    );

    return {
        kind: PQP.Language.Type.TypeKind.List,
        isNullable: false,
        maybeExtendedKind: PQP.Language.Type.ExtendedTypeKind.DefinedList,
        elements,
    };
}
