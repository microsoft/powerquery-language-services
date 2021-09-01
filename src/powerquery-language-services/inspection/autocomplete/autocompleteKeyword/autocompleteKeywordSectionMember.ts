// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    AncestryUtils,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { autocompleteKeywordRightMostLeaf } from "./common";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordSectionMember(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const maybeChildAttributeIndex: number | undefined = state.child.node.maybeAttributeIndex;

    // SectionMember.namePairedExpression
    if (maybeChildAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const maybeSharedConstant: XorNode<Ast.TConstant> | undefined = NodeIdMapUtils.maybeNthChildChecked<
            Ast.TConstant
        >(state.nodeIdMapCollection, state.parent.node.id, 1, Ast.NodeKind.Constant);

        // 'shared' was parsed so we can exit.
        if (maybeSharedConstant !== undefined) {
            return undefined;
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const maybeName: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
            state.activeNode.ancestry,
            state.ancestryIndex,
            2,
        );
        // Name hasn't been parsed yet so we can exit.
        if (
            !maybeName ||
            !XorNodeUtils.isAstXorChecked<Ast.IdentifierPairedExpression>(maybeName, [
                Ast.NodeKind.IdentifierPairedExpression,
            ])
        ) {
            return undefined;
        }

        if (Keyword.KeywordKind.Shared.startsWith(maybeName.node.key.literal)) {
            return [Keyword.KeywordKind.Shared];
        }

        return undefined;
    }
    // `section foo; bar = 1 |` would be expecting a semicolon.
    // The autocomplete should be for the IdentifierPairedExpression found on the previous child index.
    else if (maybeChildAttributeIndex === 3 && XorNodeUtils.isContextXor(state.child)) {
        const identifierPairedExpression: Ast.IdentifierPairedExpression = NodeIdMapUtils.assertUnboxNthChildAsAstChecked(
            state.nodeIdMapCollection,
            state.parent.node.id,
            2,
            Ast.NodeKind.IdentifierPairedExpression,
        );
        return autocompleteKeywordRightMostLeaf(state, identifierPairedExpression.id);
    } else {
        return undefined;
    }
}
