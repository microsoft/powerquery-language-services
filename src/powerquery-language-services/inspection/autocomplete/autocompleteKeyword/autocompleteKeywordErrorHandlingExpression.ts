// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, PositionUtils } from "../../position";
import { TrailingToken } from "../commonTypes";
import { InspectAutocompleteKeywordState } from "./commonTypes";

export function autocompleteKeywordErrorHandlingExpression(
    state: InspectAutocompleteKeywordState,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined {
    const position: Position = state.activeNode.position;
    const child: PQP.Parser.TXorNode = state.child;
    const maybeTrailingText: TrailingToken | undefined = state.maybeTrailingToken;

    const maybeChildAttributeIndex: number | undefined = child.node.maybeAttributeIndex;
    if (maybeChildAttributeIndex === 0) {
        return [PQP.Language.Keyword.KeywordKind.Try];
    } else if (maybeChildAttributeIndex === 1) {
        // 'try true o|' creates a ParseError.
        // It's ambiguous if the next token should be either 'otherwise' or 'or'.
        if (maybeTrailingText !== undefined) {
            const trailingToken: TrailingToken = maybeTrailingText;

            // First we test if we can autocomplete using the error token.
            if (
                trailingToken.kind === PQP.Language.Token.TokenKind.Identifier &&
                PositionUtils.isInToken(position, trailingToken, false, true)
            ) {
                const tokenData: string = maybeTrailingText.data;

                // If we can exclude 'or' then the only thing we can autocomplete is 'otherwise'.
                if (tokenData.length > 1 && PQP.Language.Keyword.KeywordKind.Otherwise.startsWith(tokenData)) {
                    return [PQP.Language.Keyword.KeywordKind.Otherwise];
                }
                // In the ambiguous case we don't know what they're typing yet, so we suggest both.
                // In the case of an identifier that doesn't match a 'or' or 'otherwise'
                // we still suggest the only valid keywords allowed.
                // In both cases the return is the same.
                else {
                    return [PQP.Language.Keyword.KeywordKind.Or, PQP.Language.Keyword.KeywordKind.Otherwise];
                }
            }

            // There exists an error token we can't map it to an OtherwiseExpression.
            else {
                return undefined;
            }
        } else if (child.kind === PQP.Parser.XorNodeKind.Ast && PositionUtils.isAfterAst(position, child.node, true)) {
            return [PQP.Language.Keyword.KeywordKind.Otherwise];
        } else {
            return PQP.Language.Keyword.ExpressionKeywordKinds;
        }
    } else {
        return undefined;
    }
}
