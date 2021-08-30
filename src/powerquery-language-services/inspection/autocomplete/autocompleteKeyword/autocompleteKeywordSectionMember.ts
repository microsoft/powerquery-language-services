// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { autocompleteKeywordRightMostLeaf } from "./common";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordSectionMember(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    const maybeChildAttributeIndex: number | undefined = state.child.node.maybeAttributeIndex;

    // SectionMember.namePairedExpression
    if (maybeChildAttributeIndex === 2) {
        // A test for 'shared', which as we're on namePairedExpression we either parsed it or skipped it.
        const maybeSharedConstant:
            | PQP.Parser.XorNode<PQP.Language.Ast.TConstant>
            | undefined = PQP.Parser.NodeIdMapUtils.maybeNthChildChecked<PQP.Language.Ast.TConstant>(
            state.nodeIdMapCollection,
            state.parent.node.id,
            1,
            PQP.Language.Ast.NodeKind.Constant,
        );

        // 'shared' was parsed so we can exit.
        if (maybeSharedConstant !== undefined) {
            return undefined;
        }

        // SectionMember -> IdentifierPairedExpression -> Identifier
        const maybeName: PQP.Parser.TXorNode | undefined = PQP.Parser.AncestryUtils.maybeNthPreviousXorChecked(
            state.activeNode.ancestry,
            state.ancestryIndex,
            2,
            [PQP.Language.Ast.NodeKind.IdentifierPairedExpression, PQP.Language.Ast.NodeKind.Identifier],
        );

        // Name hasn't been parsed yet so we can exit.
        if (maybeName?.kind !== PQP.Parser.XorNodeKind.Ast) {
            return undefined;
        }

        const name: PQP.Language.Ast.Identifier = maybeName.node as PQP.Language.Ast.Identifier;
        if (PQP.Language.Keyword.KeywordKind.Shared.startsWith(name.literal)) {
            return [PQP.Language.Keyword.KeywordKind.Shared];
        }

        return undefined;
    }
    // `section foo; bar = 1 |` would be expecting a semicolon.
    // The autocomplete should be for the IdentifierPairedExpression found on the previous child index.
    else if (maybeChildAttributeIndex === 3 && state.child.kind === PQP.Parser.XorNodeKind.Context) {
        const identifierPairedExpression: PQP.Language.Ast.IdentifierPairedExpression = PQP.Parser.NodeIdMapUtils.assertUnwrapNthChildAsAstChecked(
            state.nodeIdMapCollection,
            state.parent.node.id,
            2,
            PQP.Language.Ast.NodeKind.IdentifierPairedExpression,
        );
        return autocompleteKeywordRightMostLeaf(state, identifierPairedExpression.id);
    } else {
        return undefined;
    }
}
