// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeList(state: InspectTypeState, xorNode: TXorNode): Type.DefinedList {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.iterListItems(state.nodeIdMapCollection, xorNode);
    const elements: ReadonlyArray<Type.TPowerQueryType> = items.map((item: TXorNode) => inspectXor(state, item));

    return {
        kind: Type.TypeKind.List,
        isNullable: false,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        elements,
    };
}
