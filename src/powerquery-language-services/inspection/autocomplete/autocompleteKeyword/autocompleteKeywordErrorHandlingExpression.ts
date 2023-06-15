// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword, Token } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Position } from "vscode-languageserver-types";

import { InspectAutocompleteKeywordState } from "./commonTypes";
import { PositionUtils } from "../../..";
import { TrailingToken } from "../commonTypes";

export function autocompleteKeywordErrorHandlingExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<Keyword.KeywordKind> | undefined {
    const position: Position = state.activeNode.position;
    const child: TXorNode = state.child;
    const trailingText: TrailingToken | undefined = state.trailingToken;
    const childAttributeIndex: number | undefined = child.node.attributeIndex;

    if (childAttributeIndex === 0) {
        return [Keyword.KeywordKind.Try];
    } else if (childAttributeIndex === 1) {
        // 'try true o|' creates a ParseError.
        // It's ambiguous if the next token should be either 'otherwise', 'or', or 'catch'.
        if (trailingText !== undefined) {
            const trailingToken: TrailingToken = trailingText;

            // First we test if we can autocomplete using the error token.
            if (
                trailingToken.kind === Token.TokenKind.Identifier &&
                PositionUtils.isInToken(position, trailingToken, false, true)
            ) {
                const tokenData: string = trailingText.data;

                // If we can exclude 'or' then the only thing we can autocomplete is 'otherwise'.
                if (tokenData.length > 1 && Keyword.KeywordKind.Otherwise.startsWith(tokenData)) {
                    return [Keyword.KeywordKind.Otherwise];
                }
                // In the ambiguous case we don't know what they're typing yet, so we suggest both.
                // In the case of an identifier that doesn't match a 'or' or 'otherwise'
                // we still suggest the only valid keywords allowed.
                // In both cases the return is the same.
                else {
                    return [Keyword.KeywordKind.Or, Keyword.KeywordKind.Otherwise];
                }
            }

            // There exists an error token we can't map it to an OtherwiseExpression.
            else {
                return undefined;
            }
        } else if (XorNodeUtils.isAst(child) && PositionUtils.isAfterAst(position, child.node, true)) {
            return [Keyword.KeywordKind.Otherwise];
        } else {
            return Keyword.ExpressionKeywordKinds;
        }
    } else {
        return undefined;
    }
}
