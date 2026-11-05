// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AncestryUtils, NodeIdMapUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { InspectAutocompleteKeywordState } from "./commonTypes";
import { PositionUtils } from "../../..";

export function autocompleteKeywordIdentifierPairedExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const childAttributeIndex: number | undefined = state.child.node.attributeIndex;

    // `section; s|`
    // `section; [] |`
    if (
        childAttributeIndex === 0 &&
        AncestryUtils.nthChecked<Ast.SectionMember>(
            state.activeNode.ancestry,
            state.ancestryIndex + 1,
            Ast.NodeKind.SectionMember,
        )
    ) {
        return [Keyword.KeywordKind.Shared];
    } else if (childAttributeIndex !== 2) {
        return [];
    }

    const leaf: Ast.TNode | undefined = NodeIdMapUtils.leftMostLeaf(state.nodeIdMapCollection, state.child.node.id);

    // `x = |`
    // `x = |1`
    if (leaf === undefined || PositionUtils.isBeforeAst(state.activeNode.position, leaf, false)) {
        return Keyword.ExpressionKeywordKinds;
    } else {
        return undefined;
    }
}
