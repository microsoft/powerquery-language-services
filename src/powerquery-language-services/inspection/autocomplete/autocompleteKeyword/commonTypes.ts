// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { ActiveNode } from "../../activeNode";
import { TrailingToken } from "../commonTypes";

export interface InspectAutocompleteKeywordState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly activeNode: ActiveNode;
    readonly trailingToken: TrailingToken | undefined;
    parent: TXorNode;
    child: TXorNode;
    ancestryIndex: number;
}
