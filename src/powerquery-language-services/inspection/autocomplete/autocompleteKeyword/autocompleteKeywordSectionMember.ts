// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMapUtils,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { autocompleteKeywordRightMostLeaf } from "./common";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordSectionMember(
    state: InspectAutocompleteKeywordState,
): Promise<ReadonlyArray<Keyword.KeywordKind> | undefined> {
    const maybeChildAttributeIndex: number | undefined = state.child.node.attributeIndex;

    // SectionMember.namePairedExpression
    if (maybeChildAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const maybeSharedConstant: XorNode<Ast.TConstant> | undefined = NodeIdMapUtils.nthChildChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            state.parent.node.id,
            1,
            Ast.NodeKind.Constant,
        );

        // 'shared' was parsed so we can exit.
        if (maybeSharedConstant !== undefined) {
            return Promise.resolve(undefined);
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const maybeName: TXorNode | undefined = AncestryUtils.nthPreviousXor(
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
            return Promise.resolve(undefined);
        }

        if (Keyword.KeywordKind.Shared.startsWith(maybeName.node.key.literal)) {
            return Promise.resolve([Keyword.KeywordKind.Shared]);
        }

        return Promise.resolve(undefined);
    }
    // `section foo; bar = 1 |` would be expecting a semicolon.
    // The autocomplete should be for the IdentifierPairedExpression found on the previous child index.
    else if (maybeChildAttributeIndex === 3 && XorNodeUtils.isContextXor(state.child)) {
        const identifierPairedExpression: Ast.IdentifierPairedExpression =
            NodeIdMapUtils.assertUnboxNthChildAsAstChecked<Ast.IdentifierPairedExpression>(
                state.nodeIdMapCollection,
                state.parent.node.id,
                2,
                Ast.NodeKind.IdentifierPairedExpression,
            );

        return autocompleteKeywordRightMostLeaf(state, identifierPairedExpression.id);
    } else {
        return Promise.resolve(undefined);
    }
}
