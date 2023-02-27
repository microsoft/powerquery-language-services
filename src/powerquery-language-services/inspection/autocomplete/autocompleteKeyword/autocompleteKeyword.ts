// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils, TActiveNode } from "../../activeNode";
import { AutocompleteItem, AutocompleteItemUtils } from "../autocompleteItem";
import { TrailingToken, TriedAutocompleteKeyword } from "../commonTypes";
import { autocompleteKeywordDefault } from "./autocompleteKeywordDefault";
import { autocompleteKeywordErrorHandlingExpression } from "./autocompleteKeywordErrorHandlingExpression";
import { autocompleteKeywordIdentifierPairedExpression } from "./autocompleteKeywordIdentifierPairedExpression";
import { autocompleteKeywordLetExpression } from "./autocompleteKeywordLetExpression";
import { autocompleteKeywordListExpression } from "./autocompleteKeywordListExpression";
import { autocompleteKeywordSectionMember } from "./autocompleteKeywordSectionMember";
import { autocompleteKeywordTrailingText } from "./autocompleteKeywordTrailingText";
import { InspectAutocompleteKeywordState } from "./commonTypes";
import { PositionUtils } from "../../..";

export function tryAutocompleteKeyword(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: TActiveNode,
    trailingToken: TrailingToken | undefined,
): Promise<TriedAutocompleteKeyword> {
    if (!ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return Promise.resolve(
            ResultUtils.ok([
                ...Keyword.ExpressionKeywordKinds.map((keywordKind: Keyword.KeywordKind) =>
                    AutocompleteItemUtils.fromKeywordKind(keywordKind),
                ),
                AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.Section),
            ]),
        );
    }

    return ResultUtils.ensureResultAsync(
        () => autocompleteKeyword(nodeIdMapCollection, activeNode, trailingToken),
        settings.locale,
    );
}

export async function autocompleteKeyword(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    trailingToken: TrailingToken | undefined,
): Promise<ReadonlyArray<AutocompleteItem>> {
    const ancestryLeaf: TXorNode = ActiveNodeUtils.assertGetLeaf(activeNode);
    let positionName: string | undefined;

    if (PositionUtils.isInXor(nodeIdMapCollection, activeNode.position, ancestryLeaf, false, true)) {
        if (activeNode.exclusiveIdentifierUnderPosition !== undefined) {
            positionName = activeNode.exclusiveIdentifierUnderPosition.normalizedLiteral;
        }
        // Matches 'null', 'true', and 'false'.
        else if (
            XorNodeUtils.isAstXorChecked<Ast.LiteralExpression>(ancestryLeaf, Ast.NodeKind.LiteralExpression) &&
            (ancestryLeaf.node.literalKind === Ast.LiteralKind.Logical ||
                ancestryLeaf.node.literalKind === Ast.LiteralKind.Null)
        ) {
            positionName = ancestryLeaf.node.literal;
        }
    }

    if (activeNode.ancestry.length < 2) {
        return Promise.resolve(
            createAutocompleteItems(handleConjunctions(activeNode, [], trailingToken), positionName),
        );
    }

    const state: InspectAutocompleteKeywordState = {
        nodeIdMapCollection,
        activeNode,
        trailingToken,
        parent: activeNode.ancestry[1],
        child: ActiveNodeUtils.assertGetLeaf(activeNode),
        ancestryIndex: 0,
    };

    const edgeCase: ReadonlyArray<AutocompleteItem> | undefined = findEdgeCase(state, trailingToken);

    if (edgeCase !== undefined) {
        return Promise.resolve(edgeCase);
    }

    const keywordKinds: ReadonlyArray<Keyword.KeywordKind> = await traverseAncestors(state);

    const keywordsSubset: ReadonlyArray<Keyword.KeywordKind> = handleConjunctions(
        state.activeNode,
        keywordKinds,
        trailingToken,
    );

    return Promise.resolve(createAutocompleteItems(keywordsSubset, positionName));
}

const ConjunctionKeywords: ReadonlyArray<Keyword.KeywordKind> = [
    Keyword.KeywordKind.And,
    Keyword.KeywordKind.As,
    Keyword.KeywordKind.Is,
    Keyword.KeywordKind.Meta,
    Keyword.KeywordKind.Or,
];

// Travel the ancestry path in Active node in [parent, child] pairs.
// Without zipping the values we wouldn't know what we're completing for.
// For example 'if true |' gives us a pair something like [IfExpression, Constant].
// We can now know we failed to parse a 'then' constant.
async function traverseAncestors(state: InspectAutocompleteKeywordState): Promise<ReadonlyArray<Keyword.KeywordKind>> {
    const ancestry: ReadonlyArray<TXorNode> = state.activeNode.ancestry;
    const numNodes: number = ancestry.length;

    let inspected: ReadonlyArray<Keyword.KeywordKind> | undefined;

    for (let ancestryIndex: number = 1; ancestryIndex < numNodes; ancestryIndex += 1) {
        state.ancestryIndex = ancestryIndex;
        state.parent = ancestry[ancestryIndex];
        state.child = ancestry[ancestryIndex - 1];

        switch (state.parent.node.kind) {
            case Ast.NodeKind.ErrorHandlingExpression:
                inspected = autocompleteKeywordErrorHandlingExpression(state);
                break;

            case Ast.NodeKind.IdentifierPairedExpression:
                inspected = autocompleteKeywordIdentifierPairedExpression(state);
                break;

            case Ast.NodeKind.LetExpression:
                // eslint-disable-next-line no-await-in-loop
                inspected = await autocompleteKeywordLetExpression(state);
                break;

            case Ast.NodeKind.ListExpression:
                inspected = autocompleteKeywordListExpression(state);
                break;

            case Ast.NodeKind.SectionMember:
                // eslint-disable-next-line no-await-in-loop
                inspected = await autocompleteKeywordSectionMember(state);
                break;

            default:
                inspected = autocompleteKeywordDefault(state);
        }

        if (inspected !== undefined) {
            return inspected;
        }
    }

    return [];
}

function findEdgeCase(
    state: InspectAutocompleteKeywordState,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    let inspected: ReadonlyArray<AutocompleteItem> | undefined;

    // The user is typing in a new file, which the parser defaults to searching for an identifier.
    // `l|` -> `let`
    if (
        trailingToken === undefined &&
        ancestry.length === 2 &&
        XorNodeUtils.isAstXorChecked<Ast.Identifier>(ancestry[0], Ast.NodeKind.Identifier) &&
        XorNodeUtils.isNodeKind(ancestry[1], Ast.NodeKind.IdentifierExpression)
    ) {
        const identifier: string = ancestry[0].node.literal;

        inspected = Keyword.StartOfDocumentKeywords.map((keywordKind: Keyword.KeywordKind) =>
            AutocompleteItemUtils.fromKeywordKind(keywordKind, identifier),
        );
    }

    // `(x |) => x+1` -> `(x as|) => x+1`
    else if (
        XorNodeUtils.isAstXorChecked<Ast.Identifier>(ancestry[0], Ast.NodeKind.Identifier) &&
        XorNodeUtils.isNodeKind<Ast.TParameter>(ancestry[1], Ast.NodeKind.Parameter) &&
        PositionUtils.isAfterAst(activeNode.position, ancestry[0].node, true)
    ) {
        inspected = [AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.As)];
    }

    // `(foo a|) => foo` -> `(foo as) => foo
    else if (
        trailingToken?.data === "a" &&
        XorNodeUtils.isContextXorChecked<Ast.TConstant>(ancestry[0], Ast.NodeKind.Constant) &&
        XorNodeUtils.isNodeKind<Ast.TParameterList>(ancestry[1], Ast.NodeKind.ParameterList) &&
        XorNodeUtils.isNodeKind<Ast.FunctionExpression>(ancestry[2], Ast.NodeKind.FunctionExpression)
    ) {
        inspected = [AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.As)];
    }

    return inspected;
}

function createAutocompleteItems(
    keywordKinds: ReadonlyArray<Keyword.KeywordKind>,
    positionName: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return keywordKinds.map((kind: Keyword.KeywordKind) => AutocompleteItemUtils.fromKeywordKind(kind, positionName));
}

function handleConjunctions(
    activeNode: ActiveNode,
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    trailingToken: TrailingToken | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    if (
        activeNode.leafKind !== ActiveNodeLeafKind.AfterAstNode &&
        activeNode.leafKind !== ActiveNodeLeafKind.ContextNode
    ) {
        return inspected;
    }

    // Might be a section document.
    // `[x=1] s`
    // `[x=1] |`
    if (
        activeNode.ancestry.length === 2 &&
        XorNodeUtils.isAstXorChecked<Ast.RecordExpression>(activeNode.ancestry[1], Ast.NodeKind.RecordExpression)
    ) {
        if (trailingToken === undefined) {
            return PQP.ArrayUtils.concatUnique(inspected, [Keyword.KeywordKind.Section]);
        } else if (
            trailingToken.kind === PQP.Language.Token.TokenKind.Identifier &&
            PositionUtils.isInToken(activeNode.position, trailingToken, true, true)
        ) {
            return autocompleteKeywordTrailingText(inspected, trailingToken, [Keyword.KeywordKind.Section]);
        }
    }

    const activeNodeLeaf: TXorNode = ActiveNodeUtils.assertGetLeaf(activeNode);

    // `let x = 1 a|`
    if (trailingToken !== undefined && trailingToken.isInOrOnPosition) {
        return autocompleteKeywordTrailingText(inspected, trailingToken, undefined);
    }
    // `let x = |`
    // `let x = 1|`
    // `let x = 1 | a`
    else if (XorNodeUtils.isTUnaryType(activeNodeLeaf)) {
        // `let x = 1 | a`
        if (
            trailingToken !== undefined &&
            PositionUtils.isAfterTokenPosition(activeNode.position, trailingToken.positionStart, false)
        ) {
            return inspected;
        }
        // `let x = 1|`
        else if (XorNodeUtils.isAstXor(activeNodeLeaf)) {
            return PQP.ArrayUtils.concatUnique(inspected, ConjunctionKeywords);
        }
        // `let x = |`
        else {
            return inspected;
        }
    } else {
        return inspected;
    }
}
