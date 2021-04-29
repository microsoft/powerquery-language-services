// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { PositionUtils } from "../../..";

import { ActiveNode } from "../../activeNode";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordListExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestryIndex: number = state.ancestryIndex;
    const child: PQP.Parser.TXorNode = state.child;

    // '{' or '}'
    if (child.node.maybeAttributeIndex === 0 || child.node.maybeAttributeIndex === 2) {
        return undefined;
    }
    Assert.isTrue(child.node.maybeAttributeIndex === 1, `must be in range [0, 2]`, {
        nodeId: child.node.id,
        maybeAttributeIndex: child.node.maybeAttributeIndex,
    });

    // ListExpression -> ArrayWrapper -> Csv -> X
    const nodeOrComma: PQP.Parser.TXorNode = PQP.Parser.AncestryUtils.assertGetNthPreviousXor(
        activeNode.ancestry,
        ancestryIndex,
        3,
        undefined,
    );
    if (nodeOrComma.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // We know it's the node component of the Csv,
    // but we have to drill down one more level if it's a RangeExpression.
    const itemNode: PQP.Parser.TXorNode =
        nodeOrComma.node.kind === PQP.Language.Ast.NodeKind.RangeExpression
            ? PQP.Parser.AncestryUtils.assertGetNthPreviousXor(activeNode.ancestry, ancestryIndex, 4, undefined)
            : nodeOrComma;

    if (
        itemNode.kind === PQP.Parser.XorNodeKind.Context ||
        PositionUtils.isBeforeXor(activeNode.position, itemNode, false)
    ) {
        return PQP.Language.Keyword.ExpressionKeywordKinds;
    } else {
        return undefined;
    }
}
