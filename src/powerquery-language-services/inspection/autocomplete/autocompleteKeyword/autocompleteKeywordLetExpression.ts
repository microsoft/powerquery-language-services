// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { autocompleteKeywordDefault } from "./autocompleteKeywordDefault";
import { autocompleteKeywordRightMostLeaf } from "./common";
import { autocompleteKeywordTrailingText } from "./autocompleteKeywordTrailingText";
import { InspectAutocompleteKeywordState } from "./commonTypes";
import { PositionUtils } from "../../..";

export async function autocompleteKeywordLetExpression(
    state: InspectAutocompleteKeywordState,
): Promise<ReadonlyArray<Keyword.KeywordKind> | undefined> {
    // LetExpressions can trigger another inspection which will always hit the same LetExpression.
    // Make sure that it doesn't trigger an infinite recursive call.
    const child: TXorNode = state.child;
    let maybeInspected: ReadonlyArray<Keyword.KeywordKind> | undefined;

    // Might be either `in` or whatever the autocomplete is for the the last child of the variableList.
    // `let x = 1 |`
    if (child.node.maybeAttributeIndex === 2 && XorNodeUtils.isContextXor(child)) {
        maybeInspected = await autocompleteLastKeyValuePair(
            state,
            NodeIdMapIterator.iterLetExpression(
                state.nodeIdMapCollection,
                XorNodeUtils.assertAsLetExpression(state.parent),
            ),
        );

        if (state.maybeTrailingToken !== undefined) {
            if (state.maybeTrailingToken.isInOrOnPosition === true) {
                // We don't want maybeInspected to be zero legnth.
                // It's either undefined or non-zero length.
                maybeInspected = autocompleteKeywordTrailingText(maybeInspected ?? [], state.maybeTrailingToken, [
                    Keyword.KeywordKind.In,
                ]);

                return maybeInspected.length ? maybeInspected : undefined;
            } else if (
                PositionUtils.isBeforeTokenPosition(
                    state.activeNode.position,
                    state.maybeTrailingToken.positionStart,
                    true,
                )
            ) {
                return maybeInspected !== undefined ? [...maybeInspected, Keyword.KeywordKind.In] : maybeInspected;
            }
        } else {
            return maybeInspected !== undefined
                ? [...maybeInspected, Keyword.KeywordKind.In]
                : [Keyword.KeywordKind.In];
        }
    }

    return maybeInspected ?? autocompleteKeywordDefault(state);
}

function autocompleteLastKeyValuePair(
    state: InspectAutocompleteKeywordState,
    keyValuePairs: ReadonlyArray<NodeIdMapIterator.TKeyValuePair>,
): Promise<ReadonlyArray<Keyword.KeywordKind> | undefined> {
    if (keyValuePairs.length === 0) {
        return Promise.resolve(undefined);
    }

    // Grab the last value (if one exists)
    const maybeLastValue: TXorNode | undefined = keyValuePairs[keyValuePairs.length - 1].maybeValue;

    if (maybeLastValue === undefined) {
        return Promise.resolve(undefined);
    }

    return autocompleteKeywordRightMostLeaf(state, maybeLastValue.node.id);
}
