// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Ast, Keyword, KeywordUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { AncestryUtils, NodeIdMapUtils, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { CommonError } from "@microsoft/powerquery-parser";

import { ActiveNode } from "../../activeNode";
import { AutocompleteItem } from "../autocompleteItem";
import { autocompleteKeyword } from "./autocompleteKeyword";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordRightMostLeaf(
    state: InspectAutocompleteKeywordState,
    xorNodeId: number,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    // Grab the right-most Ast node in the last value.
    const maybeRightMostAstLeafForLastValue: Ast.TNode | undefined = NodeIdMapUtils.maybeRightMostLeaf(
        state.nodeIdMapCollection,
        xorNodeId,
        undefined,
    );
    if (maybeRightMostAstLeafForLastValue === undefined) {
        return undefined;
    }

    // Start a new autocomplete inspection where the ActiveNode's ancestry is the right-most Ast node in the last value.
    const shiftedAncestry: ReadonlyArray<TXorNode> = AncestryUtils.assertGetAncestry(
        state.nodeIdMapCollection,
        maybeRightMostAstLeafForLastValue.id,
    );
    Assert.isTrue(shiftedAncestry.length >= 2, "shiftedAncestry.length >= 2");
    const shiftedActiveNode: ActiveNode = {
        ...state.activeNode,
        ancestry: shiftedAncestry,
    };

    const inspected: ReadonlyArray<AutocompleteItem> = autocompleteKeyword(
        state.nodeIdMapCollection,
        shiftedActiveNode,
        state.maybeTrailingToken,
    );

    return inspected.map((autocompleteItem: AutocompleteItem) => {
        if (!KeywordUtils.isKeyword(autocompleteItem.label)) {
            throw new CommonError.InvariantError(
                `expected ${autocompleteKeyword.name} to return only with KeywordKind values for AutocompleteItem.label`,
            );
        }

        return autocompleteItem.label;
    });
}
