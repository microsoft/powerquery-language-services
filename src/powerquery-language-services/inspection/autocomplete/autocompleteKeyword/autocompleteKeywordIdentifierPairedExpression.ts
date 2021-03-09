// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { PositionUtils } from "../../position";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordIdentifierPairedExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    const childAttributeIndex: number | undefined = state.child.node.maybeAttributeIndex;

    // `section; s|`
    // `section; [] |`
    if (
        childAttributeIndex === 0 &&
        PQP.Parser.AncestryUtils.maybeNextXor(state.activeNode.ancestry, state.ancestryIndex, [
            PQP.Language.Ast.NodeKind.SectionMember,
        ])
    ) {
        return [PQP.Language.Keyword.KeywordKind.Shared];
    } else if (childAttributeIndex !== 2) {
        return [];
    }
    const maybeLeaf: PQP.Language.Ast.TNode | undefined = PQP.Parser.NodeIdMapUtils.maybeLeftMostLeaf(
        state.nodeIdMapCollection,
        state.child.node.id,
    );
    // `x = |`
    // `x = |1`
    if (maybeLeaf === undefined || PositionUtils.isBeforeAst(state.activeNode.position, maybeLeaf, false)) {
        return PQP.Language.Keyword.ExpressionKeywordKinds;
    } else {
        return undefined;
    }
}
