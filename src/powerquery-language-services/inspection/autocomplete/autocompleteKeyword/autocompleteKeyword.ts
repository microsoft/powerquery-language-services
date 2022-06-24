// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeLeafKind, ActiveNodeUtils, TMaybeActiveNode } from "../../activeNode";
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
    maybeActiveNode: TMaybeActiveNode,
    maybeTrailingToken: TrailingToken | undefined,
): Promise<TriedAutocompleteKeyword> {
    if (!ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
        return Promise.resolve(
            ResultUtils.boxOk([
                ...Keyword.ExpressionKeywordKinds.map((keywordKind: Keyword.KeywordKind) =>
                    AutocompleteItemUtils.createFromKeywordKind(keywordKind),
                ),
                AutocompleteItemUtils.createFromKeywordKind(Keyword.KeywordKind.Section),
            ]),
        );
    }

    return ResultUtils.ensureResultAsync(
        () => autocompleteKeyword(nodeIdMapCollection, maybeActiveNode, maybeTrailingToken),
        settings.locale,
    );
}

export async function autocompleteKeyword(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
    maybeTrailingToken: TrailingToken | undefined,
): Promise<ReadonlyArray<AutocompleteItem>> {
    const ancestryLeaf: TXorNode = ActiveNodeUtils.assertGetLeaf(activeNode);
    let maybePositionName: string | undefined;

    if (PositionUtils.isInXor(nodeIdMapCollection, activeNode.position, ancestryLeaf, false, true)) {
        if (activeNode.maybeExclusiveIdentifierUnderPosition !== undefined) {
            maybePositionName = activeNode.maybeExclusiveIdentifierUnderPosition.normalizedLiteral;
        }
        // Matches 'null', 'true', and 'false'.
        else if (
            XorNodeUtils.isAstXorChecked<Ast.LiteralExpression>(ancestryLeaf, Ast.NodeKind.LiteralExpression) &&
            (ancestryLeaf.node.literalKind === Ast.LiteralKind.Logical ||
                ancestryLeaf.node.literalKind === Ast.LiteralKind.Null)
        ) {
            maybePositionName = ancestryLeaf.node.literal;
        }
    }

    if (activeNode.ancestry.length < 2) {
        return Promise.resolve(
            createAutocompleteItems(handleConjunctions(activeNode, [], maybeTrailingToken), maybePositionName),
        );
    }

    const state: InspectAutocompleteKeywordState = {
        nodeIdMapCollection,
        activeNode,
        maybeTrailingToken,
        parent: activeNode.ancestry[1],
        child: ActiveNodeUtils.assertGetLeaf(activeNode),
        ancestryIndex: 0,
    };

    const maybeEdgeCase: ReadonlyArray<AutocompleteItem> | undefined = getMaybeEdgeCase(state, maybeTrailingToken);

    if (maybeEdgeCase !== undefined) {
        return Promise.resolve(maybeEdgeCase);
    }

    const keywordKinds: ReadonlyArray<Keyword.KeywordKind> = await traverseAncestors(state);

    const keywordsSubset: ReadonlyArray<Keyword.KeywordKind> = handleConjunctions(
        state.activeNode,
        keywordKinds,
        maybeTrailingToken,
    );

    return Promise.resolve(createAutocompleteItems(keywordsSubset, maybePositionName));
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

    let maybeInspected: ReadonlyArray<Keyword.KeywordKind> | undefined;

    for (let ancestryIndex: number = 1; ancestryIndex < numNodes; ancestryIndex += 1) {
        state.ancestryIndex = ancestryIndex;
        state.parent = ancestry[ancestryIndex];
        state.child = ancestry[ancestryIndex - 1];

        switch (state.parent.node.kind) {
            case Ast.NodeKind.ErrorHandlingExpression:
                maybeInspected = autocompleteKeywordErrorHandlingExpression(state);
                break;

            case Ast.NodeKind.IdentifierPairedExpression:
                maybeInspected = autocompleteKeywordIdentifierPairedExpression(state);
                break;

            case Ast.NodeKind.LetExpression:
                // eslint-disable-next-line no-await-in-loop
                maybeInspected = await autocompleteKeywordLetExpression(state);
                break;

            case Ast.NodeKind.ListExpression:
                maybeInspected = autocompleteKeywordListExpression(state);
                break;

            case Ast.NodeKind.SectionMember:
                // eslint-disable-next-line no-await-in-loop
                maybeInspected = await autocompleteKeywordSectionMember(state);
                break;

            default:
                maybeInspected = autocompleteKeywordDefault(state);
        }

        if (maybeInspected !== undefined) {
            return maybeInspected;
        }
    }

    return [];
}

function getMaybeEdgeCase(
    state: InspectAutocompleteKeywordState,
    maybeTrailingToken: TrailingToken | undefined,
): ReadonlyArray<AutocompleteItem> | undefined {
    const activeNode: ActiveNode = state.activeNode;
    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    let maybeInspected: ReadonlyArray<AutocompleteItem> | undefined;

    // The user is typing in a new file, which the parser defaults to searching for an identifier.
    // `l|` -> `let`
    if (
        maybeTrailingToken === undefined &&
        ancestry.length === 2 &&
        XorNodeUtils.isAstXorChecked<Ast.Identifier>(ancestry[0], Ast.NodeKind.Identifier) &&
        XorNodeUtils.isNodeKind(ancestry[1], Ast.NodeKind.IdentifierExpression)
    ) {
        const identifier: string = ancestry[0].node.literal;

        maybeInspected = Keyword.StartOfDocumentKeywords.map((keywordKind: Keyword.KeywordKind) =>
            AutocompleteItemUtils.createFromKeywordKind(keywordKind, identifier),
        );
    }

    // `(x |) => x+1` -> `(x as|) => x+1`
    else if (
        XorNodeUtils.isAstXorChecked<Ast.Identifier>(ancestry[0], Ast.NodeKind.Identifier) &&
        XorNodeUtils.isNodeKind<Ast.TParameter>(ancestry[1], Ast.NodeKind.Parameter) &&
        PositionUtils.isAfterAst(activeNode.position, ancestry[0].node, true)
    ) {
        maybeInspected = [AutocompleteItemUtils.createFromKeywordKind(Keyword.KeywordKind.As)];
    }

    // `(foo a|) => foo` -> `(foo as) => foo
    else if (
        maybeTrailingToken?.data === "a" &&
        XorNodeUtils.isContextXorChecked<Ast.TConstant>(ancestry[0], Ast.NodeKind.Constant) &&
        XorNodeUtils.isNodeKind<Ast.TParameterList>(ancestry[1], Ast.NodeKind.ParameterList) &&
        XorNodeUtils.isNodeKind<Ast.FunctionExpression>(ancestry[2], Ast.NodeKind.FunctionExpression)
    ) {
        maybeInspected = [AutocompleteItemUtils.createFromKeywordKind(Keyword.KeywordKind.As)];
    }

    return maybeInspected;
}

function createAutocompleteItems(
    keywordKinds: ReadonlyArray<Keyword.KeywordKind>,
    maybePositionName: string | undefined,
): ReadonlyArray<AutocompleteItem> {
    return keywordKinds.map((kind: Keyword.KeywordKind) =>
        AutocompleteItemUtils.createFromKeywordKind(kind, maybePositionName),
    );
}

function handleConjunctions(
    activeNode: ActiveNode,
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    maybeTrailingToken: TrailingToken | undefined,
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
        if (maybeTrailingToken === undefined) {
            return PQP.ArrayUtils.concatUnique(inspected, [Keyword.KeywordKind.Section]);
        } else if (
            maybeTrailingToken.kind === PQP.Language.Token.TokenKind.Identifier &&
            PositionUtils.isInToken(activeNode.position, maybeTrailingToken, true, true)
        ) {
            return autocompleteKeywordTrailingText(inspected, maybeTrailingToken, [Keyword.KeywordKind.Section]);
        }
    }

    const activeNodeLeaf: TXorNode = ActiveNodeUtils.assertGetLeaf(activeNode);

    // `let x = 1 a|`
    if (maybeTrailingToken !== undefined && maybeTrailingToken.isInOrOnPosition) {
        return autocompleteKeywordTrailingText(inspected, maybeTrailingToken, undefined);
    }
    // `let x = |`
    // `let x = 1|`
    // `let x = 1 | a`
    else if (XorNodeUtils.isTUnaryType(activeNodeLeaf)) {
        // `let x = 1 | a`
        if (
            maybeTrailingToken !== undefined &&
            PositionUtils.isAfterTokenPosition(activeNode.position, maybeTrailingToken.positionStart, false)
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
