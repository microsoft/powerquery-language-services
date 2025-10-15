// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMapUtils,
    type TXorNode,
    type XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { autocompleteKeywordRightMostLeaf } from "./common";
import { type InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordSectionMember(
    state: InspectAutocompleteKeywordState,
): Promise<ReadonlyArray<Keyword.KeywordKind> | undefined> {
    const childAttributeIndex: number | undefined = state.child.node.attributeIndex;

    // SectionMember.namePairedExpression
    if (childAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const sharedConstant: XorNode<Ast.TConstant> | undefined = NodeIdMapUtils.nthChildXorChecked<Ast.TConstant>(
            state.nodeIdMapCollection,
            state.parent.node.id,
            1,
            Ast.NodeKind.Constant,
        );

        // 'shared' was parsed so we can exit.
        if (sharedConstant !== undefined) {
            return Promise.resolve(undefined);
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const name: TXorNode | undefined = AncestryUtils.nth(state.activeNode.ancestry, state.ancestryIndex - 2);

        // Name hasn't been parsed yet so we can exit.
        if (
            !name ||
            !XorNodeUtils.isAstChecked<Ast.IdentifierPairedExpression>(name, [Ast.NodeKind.IdentifierPairedExpression])
        ) {
            return Promise.resolve(undefined);
        }

        if (Keyword.KeywordKind.Shared.startsWith(name.node.key.literal)) {
            return Promise.resolve([Keyword.KeywordKind.Shared]);
        }

        return Promise.resolve(undefined);
    }
    // `section foo; bar = 1 |` would be expecting a semicolon.
    // The autocomplete should be for the IdentifierPairedExpression found on the previous child index.
    else if (childAttributeIndex === 3 && XorNodeUtils.isContext(state.child)) {
        const identifierPairedExpression: Ast.IdentifierPairedExpression =
            NodeIdMapUtils.assertNthChildAstChecked<Ast.IdentifierPairedExpression>(
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
