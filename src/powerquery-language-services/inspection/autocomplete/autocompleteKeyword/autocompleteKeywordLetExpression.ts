// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { PositionUtils } from "../..";
import { autocompleteKeywordDefault } from "./autocompleteKeywordDefault";
import { autocompleteKeywordTrailingText } from "./autocompleteKeywordTrailingText";
import { autocompleteKeywordRightMostLeaf } from "./common";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordLetExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    // LetExpressions can trigger another inspection which will always hit the same LetExpression.
    // Make sure that it doesn't trigger an infinite recursive call.
    const child: PQP.Parser.TXorNode = state.child;
    let maybeInspected: ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined;

    // Might be either `in` or whatever the autocomplete is for the the last child of the variableList.
    // `let x = 1 |`
    if (child.node.maybeAttributeIndex === 2 && child.kind === PQP.Parser.XorNodeKind.Context) {
        maybeInspected = autocompleteLastKeyValuePair(
            state,
            PQP.Parser.NodeIdMapIterator.iterLetExpression(state.nodeIdMapCollection, state.parent),
        );
        if (state.maybeTrailingToken !== undefined) {
            if (state.maybeTrailingToken.isInOrOnPosition === true) {
                // We don't want maybeInspected to be zero legnth.
                // It's either undefined or non-zero length.
                maybeInspected = autocompleteKeywordTrailingText(maybeInspected ?? [], state.maybeTrailingToken, [
                    PQP.Language.Keyword.KeywordKind.In,
                ]);
                return maybeInspected.length ? maybeInspected : undefined;
            } else if (
                PositionUtils.isBeforeTokenPosition(
                    state.activeNode.position,
                    state.maybeTrailingToken.positionStart,
                    true,
                )
            ) {
                return maybeInspected !== undefined
                    ? [...maybeInspected, PQP.Language.Keyword.KeywordKind.In]
                    : maybeInspected;
            }
        } else {
            return maybeInspected !== undefined
                ? [...maybeInspected, PQP.Language.Keyword.KeywordKind.In]
                : [PQP.Language.Keyword.KeywordKind.In];
        }
    }

    return maybeInspected ?? autocompleteKeywordDefault(state);
}

function autocompleteLastKeyValuePair(
    state: InspectAutocompleteKeywordState,
    keyValuePairs: ReadonlyArray<PQP.Parser.NodeIdMapIterator.TKeyValuePair>,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    if (keyValuePairs.length === 0) {
        return undefined;
    }

    // Grab the last value (if one exists)
    const maybeLastValue: PQP.Parser.TXorNode | undefined = keyValuePairs[keyValuePairs.length - 1].maybeValue;
    if (maybeLastValue === undefined) {
        return undefined;
    }

    return autocompleteKeywordRightMostLeaf(state, maybeLastValue.node.id);
}
