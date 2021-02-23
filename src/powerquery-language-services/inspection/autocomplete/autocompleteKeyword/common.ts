// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { ActiveNode } from "../../activeNode";
import { autocompleteKeyword } from "./autocompleteKeyword";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordRightMostLeaf(
    state: InspectAutocompleteKeywordState,
    xorNodeId: number,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    // Grab the right-most Ast node in the last value.
    const maybeRightMostAstLeafForLastValue:
        | PQP.Language.Ast.TNode
        | undefined = PQP.Parser.NodeIdMapUtils.maybeRightMostLeaf(state.nodeIdMapCollection, xorNodeId, undefined);
    if (maybeRightMostAstLeafForLastValue === undefined) {
        return undefined;
    }

    // Start a new autocomplete inspection where the ActiveNode's ancestry is the right-most Ast node in the last value.
    const shiftedAncestry: ReadonlyArray<PQP.Parser.TXorNode> = PQP.Parser.AncestryUtils.assertGetAncestry(
        state.nodeIdMapCollection,
        maybeRightMostAstLeafForLastValue.id,
    );
    Assert.isTrue(shiftedAncestry.length >= 2, "shiftedAncestry.length >= 2");
    const shiftedActiveNode: ActiveNode = {
        ...state.activeNode,
        ancestry: shiftedAncestry,
    };
    const inspected: ReadonlyArray<PQP.Language.Keyword.KeywordKind> = autocompleteKeyword(
        state.nodeIdMapCollection,
        state.leafNodeIds,
        shiftedActiveNode,
        state.maybeTrailingToken,
    );

    return inspected;
}
