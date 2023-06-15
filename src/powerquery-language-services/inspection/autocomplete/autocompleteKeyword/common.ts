// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AncestryUtils, NodeIdMapUtils, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert, CommonError } from "@microsoft/powerquery-parser";
import { Ast, Keyword, KeywordUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ActiveNode } from "../../activeNode";
import { AutocompleteItem } from "../autocompleteItem";
import { autocompleteKeyword } from "./autocompleteKeyword";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export async function autocompleteKeywordRightMostLeaf(
    state: InspectAutocompleteKeywordState,
    xorNodeId: number,
): Promise<ReadonlyArray<Keyword.KeywordKind> | undefined> {
    // Grab the right-most Ast node in the last value.
    const rightMostAstLeafForLastValue: Ast.TNode | undefined = await NodeIdMapUtils.rightMostLeaf(
        state.nodeIdMapCollection,
        xorNodeId,
        undefined,
    );

    if (rightMostAstLeafForLastValue === undefined) {
        return undefined;
    }

    // Start a new autocomplete inspection where the ActiveNode's ancestry is the right-most Ast node in the last value.
    const shiftedAncestry: ReadonlyArray<TXorNode> = AncestryUtils.assertAncestry(
        state.nodeIdMapCollection,
        rightMostAstLeafForLastValue.id,
    );

    Assert.isTrue(shiftedAncestry.length >= 2, "shiftedAncestry.length >= 2");

    const shiftedActiveNode: ActiveNode = {
        ...state.activeNode,
        ancestry: shiftedAncestry,
    };

    const inspected: ReadonlyArray<AutocompleteItem> = await autocompleteKeyword(
        state.nodeIdMapCollection,
        shiftedActiveNode,
        state.trailingToken,
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
