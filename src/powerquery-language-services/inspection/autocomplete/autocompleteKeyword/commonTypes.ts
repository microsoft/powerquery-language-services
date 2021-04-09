// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ActiveNode } from "../../activeNode";
import { TrailingToken } from "../commonTypes";

export interface InspectAutocompleteKeywordState {
    readonly nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    readonly activeNode: ActiveNode;
    readonly maybeTrailingToken: TrailingToken | undefined;
    parent: PQP.Parser.TXorNode;
    child: PQP.Parser.TXorNode;
    ancestryIndex: number;
}
