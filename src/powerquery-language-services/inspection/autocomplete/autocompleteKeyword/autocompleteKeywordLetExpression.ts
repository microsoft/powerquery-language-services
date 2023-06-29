// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMapIterator,
    TXorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

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
    let inspected: ReadonlyArray<Keyword.KeywordKind> | undefined;

    // Might be either `in` or whatever the autocomplete is for the the last child of the variableList.
    // `let x = 1 |`
    if (child.node.attributeIndex === 2 && XorNodeUtils.isContext(child)) {
        inspected = await autocompleteLastKeyValuePair(
            state,
            NodeIdMapIterator.iterLetExpression(
                state.nodeIdMapCollection,
                XorNodeUtils.assertAsNodeKind<Ast.LetExpression>(state.parent, Ast.NodeKind.LetExpression),
            ),
        );

        if (state.trailingToken !== undefined) {
            if (state.trailingToken.isPositionEitherInOrOnToken) {
                // We don't want inspected to be zero legnth.
                // It's either undefined or non-zero length.
                inspected = autocompleteKeywordTrailingText(inspected ?? [], state.trailingToken, [
                    Keyword.KeywordKind.In,
                ]);

                return inspected.length ? inspected : undefined;
            } else if (
                PositionUtils.isBeforeTokenPosition(state.activeNode.position, state.trailingToken.positionStart, true)
            ) {
                return inspected !== undefined ? [...inspected, Keyword.KeywordKind.In] : inspected;
            }
        } else {
            return inspected !== undefined ? [...inspected, Keyword.KeywordKind.In] : [Keyword.KeywordKind.In];
        }
    }
    // `let foo = e|` where we want to treat the identifier as a potential keyword
    else if (child.node.attributeIndex === 1) {
        const identifier: TXorNode | undefined = AncestryUtils.nth(state.activeNode.ancestry, state.ancestryIndex - 5);

        if (identifier && XorNodeUtils.isAstChecked<Ast.Identifier>(identifier, Ast.NodeKind.Identifier)) {
            const identifierAst: Ast.Identifier = identifier.node;

            inspected = Keyword.ExpressionKeywordKinds.filter((value: Keyword.KeywordKind) =>
                value.startsWith(identifierAst.literal),
            );
        }
    }

    return inspected ?? autocompleteKeywordDefault(state);
}

function autocompleteLastKeyValuePair(
    state: InspectAutocompleteKeywordState,
    keyValuePairs: ReadonlyArray<NodeIdMapIterator.TKeyValuePair>,
): Promise<ReadonlyArray<Keyword.KeywordKind> | undefined> {
    if (keyValuePairs.length === 0) {
        return Promise.resolve(undefined);
    }

    // Grab the last value (if one exists)
    const lastValue: TXorNode | undefined = keyValuePairs[keyValuePairs.length - 1].value;

    if (lastValue === undefined) {
        return Promise.resolve(undefined);
    }

    return autocompleteKeywordRightMostLeaf(state, lastValue.node.id);
}
