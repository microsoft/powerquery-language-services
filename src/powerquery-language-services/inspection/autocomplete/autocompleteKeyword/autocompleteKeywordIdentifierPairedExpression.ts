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
        AncestryUtils.nextXorChecked<Ast.SectionMember>(
            state.activeNode.ancestry,
            state.ancestryIndex,
            Ast.NodeKind.SectionMember,
        )
    ) {
        return [Keyword.KeywordKind.Shared];
    } else if (childAttributeIndex !== 2) {
        return [];
    }

    const maybeLeaf: Ast.TNode | undefined = NodeIdMapUtils.leftMostLeaf(
        state.nodeIdMapCollection,
        state.child.node.id,
    );

    // `x = |`
    // `x = |1`
    if (maybeLeaf === undefined || PositionUtils.isBeforeAst(state.activeNode.position, maybeLeaf, false)) {
        return Keyword.ExpressionKeywordKinds;
    } else {
        return undefined;
    }
}
