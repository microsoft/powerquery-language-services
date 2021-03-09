// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeLeafKind } from "../../activeNode";
import { PositionUtils } from "../../position";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordDefault(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const child: PQP.Parser.TXorNode = state.child;
    const key: string = createMapKey(state.parent.node.kind, child.node.maybeAttributeIndex);

    if (AutocompleteExpressionKeys.indexOf(key) !== -1) {
        return autocompleteDefaultExpression(state);
    } else {
        const maybeMappedKeywordKind: PQP.Language.Keyword.KeywordKind | undefined = AutocompleteConstantMap.get(key);
        return maybeMappedKeywordKind !== undefined
            ? autocompleteKeywordConstant(activeNode, child, maybeMappedKeywordKind)
            : undefined;
    }
}

const AutocompleteExpressionKeys: ReadonlyArray<string> = [
    createMapKey(PQP.Language.Ast.NodeKind.ErrorRaisingExpression, 1),
    createMapKey(PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 2),
    createMapKey(PQP.Language.Ast.NodeKind.FunctionExpression, 3),
    createMapKey(PQP.Language.Ast.NodeKind.IdentifierPairedExpression, 2),
    createMapKey(PQP.Language.Ast.NodeKind.IfExpression, 1),
    createMapKey(PQP.Language.Ast.NodeKind.IfExpression, 3),
    createMapKey(PQP.Language.Ast.NodeKind.IfExpression, 5),
    createMapKey(PQP.Language.Ast.NodeKind.InvokeExpression, 1),
    createMapKey(PQP.Language.Ast.NodeKind.LetExpression, 3),
    createMapKey(PQP.Language.Ast.NodeKind.ListExpression, 1),
    createMapKey(PQP.Language.Ast.NodeKind.OtherwiseExpression, 1),
    createMapKey(PQP.Language.Ast.NodeKind.ParenthesizedExpression, 1),
];

// If we're coming from a constant then we can quickly evaluate using a map.
// This is possible because reading a Constant is binary.
// Either the Constant was read and you're in the next context, or you didn't and you're in the constant's context.
const AutocompleteConstantMap: Map<string, PQP.Language.Keyword.KeywordKind> = new Map<
    string,
    PQP.Language.Keyword.KeywordKind
>([
    // Ast.NodeKind.ErrorRaisingExpression
    [createMapKey(PQP.Language.Ast.NodeKind.ErrorRaisingExpression, 0), PQP.Language.Keyword.KeywordKind.Error],

    // Ast.NodeKind.IfExpression
    [createMapKey(PQP.Language.Ast.NodeKind.IfExpression, 0), PQP.Language.Keyword.KeywordKind.If],
    [createMapKey(PQP.Language.Ast.NodeKind.IfExpression, 2), PQP.Language.Keyword.KeywordKind.Then],
    [createMapKey(PQP.Language.Ast.NodeKind.IfExpression, 4), PQP.Language.Keyword.KeywordKind.Else],

    // Ast.NodeKind.LetExpression
    [createMapKey(PQP.Language.Ast.NodeKind.LetExpression, 2), PQP.Language.Keyword.KeywordKind.In],

    // Ast.NodeKind.OtherwiseExpression
    [createMapKey(PQP.Language.Ast.NodeKind.OtherwiseExpression, 0), PQP.Language.Keyword.KeywordKind.Otherwise],

    // Ast.NodeKind.Section
    [createMapKey(PQP.Language.Ast.NodeKind.Section, 1), PQP.Language.Keyword.KeywordKind.Section],
]);

function autocompleteDefaultExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const child: PQP.Parser.TXorNode = state.child;

    // '[x=|1]
    if (activeNode.leafKind === ActiveNodeLeafKind.ShiftedRight) {
        return PQP.Language.Keyword.ExpressionKeywordKinds;
    }
    // `if 1|`
    else if (
        child.kind === PQP.Parser.XorNodeKind.Ast &&
        child.node.kind === PQP.Language.Ast.NodeKind.LiteralExpression &&
        child.node.literalKind === PQP.Language.Ast.LiteralKind.Numeric
    ) {
        return [];
    }

    return PQP.Language.Keyword.ExpressionKeywordKinds;
}

function autocompleteKeywordConstant(
    activeNode: ActiveNode,
    child: PQP.Parser.TXorNode,
    keywordKind: PQP.Language.Keyword.KeywordKind,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    if (PositionUtils.isBeforeXor(activeNode.position, child, false)) {
        return undefined;
    } else if (child.kind === PQP.Parser.XorNodeKind.Ast) {
        // So long as you're inside of an Ast Constant there's nothing that can be recommended other than the constant.
        // Note that we previously checked isBeforeXorNode so we can use the quicker isOnAstNodeEnd to check
        // if we're inside of the Ast node.
        return PositionUtils.isOnAstEnd(activeNode.position, child.node) ? [] : [keywordKind];
    }

    return [keywordKind];
}

// A tuple can't easily be used as a Map key as it does a shallow comparison.
// The work around is to stringify the tuple key, even though we lose typing by doing so.
// [parent XorNode.node.kind, child XorNode.node.maybeAttributeIndex].join(",")
function createMapKey(nodeKind: PQP.Language.Ast.NodeKind, maybeAttributeIndex: number | undefined): string {
    return [nodeKind, maybeAttributeIndex].join(",");
}
