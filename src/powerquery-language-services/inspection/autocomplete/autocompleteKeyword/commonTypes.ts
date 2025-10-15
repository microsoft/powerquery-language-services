// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type NodeIdMap, type TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { type ActiveNode } from "../../activeNode";
import { type TrailingToken } from "../trailingToken";

export interface InspectAutocompleteKeywordState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly activeNode: ActiveNode;
    readonly trailingToken: TrailingToken | undefined;
    parent: TXorNode;
    child: TXorNode;
    ancestryIndex: number;
}
