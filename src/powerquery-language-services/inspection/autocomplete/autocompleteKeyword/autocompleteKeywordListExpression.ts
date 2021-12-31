// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AncestryUtils, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";

import { ActiveNode } from "../../activeNode";
import { InspectAutocompleteKeywordState } from "./commonTypes";
import { PositionUtils } from "../../..";

export function autocompleteKeywordListExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestryIndex: number = state.ancestryIndex;
    const child: TXorNode = state.child;

    // '{' or '}'
    if (child.node.maybeAttributeIndex === 0 || child.node.maybeAttributeIndex === 2) {
        return undefined;
    }
    Assert.isTrue(child.node.maybeAttributeIndex === 1, `must be in range [0, 2]`, {
        nodeId: child.node.id,
        maybeAttributeIndex: child.node.maybeAttributeIndex,
    });

    // ListExpression -> ArrayWrapper -> Csv -> X
    const nodeOrComma: TXorNode = AncestryUtils.assertGetNthPreviousXor(activeNode.ancestry, ancestryIndex, 3);
    if (nodeOrComma.node.maybeAttributeIndex !== 0) {
        return undefined;
    }

    // We know it's the node component of the Csv,
    // but we have to drill down one more level if it's a RangeExpression.
    const itemNode: TXorNode = XorNodeUtils.isNodeKind(nodeOrComma, Ast.NodeKind.RangeExpression)
        ? AncestryUtils.assertGetNthPreviousXor(activeNode.ancestry, ancestryIndex, 4)
        : nodeOrComma;

    if (XorNodeUtils.isContextXor(itemNode) || PositionUtils.isBeforeXor(activeNode.position, itemNode, false)) {
        return Keyword.ExpressionKeywordKinds;
    } else {
        return undefined;
    }
}
