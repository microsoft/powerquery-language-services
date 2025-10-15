// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Assert } from "@microsoft/powerquery-parser";
import { Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { type TrailingToken } from "../trailingToken";

export function autocompleteKeywordTrailingText(
    inspected: ReadonlyArray<Keyword.KeywordKind>,
    trailingToken: TrailingToken,
    allowedKeywords: ReadonlyArray<Keyword.KeywordKind> | undefined,
): ReadonlyArray<Keyword.KeywordKind> {
    if (trailingToken.isPositionEitherInOrOnToken === false) {
        return inspected;
    }

    Assert.isTrue(trailingToken.data.length > 0, "trailingToken.data.length > 0");
    const token: PQP.Language.Token.Token = trailingToken;

    allowedKeywords = allowedKeywords ?? PartialConjunctionKeywordAutocompleteMap.get(token.data[0]);

    if (allowedKeywords !== undefined) {
        return PQP.ArrayUtils.concatUnique(
            inspected,
            allowedKeywords.filter((keyword: Keyword.KeywordKind) => keyword.startsWith(token.data)),
        );
    } else {
        return inspected;
    }
}

// Used with parseError to see if a user could be typing a conjunctive keyword such as 'or'. Eg.
// 'Details[UserName] <> "" o|'
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<Keyword.KeywordKind>> = new Map<
    string,
    ReadonlyArray<Keyword.KeywordKind>
>([
    ["a", [Keyword.KeywordKind.And, Keyword.KeywordKind.As]],
    ["i", [Keyword.KeywordKind.Is]],
    ["m", [Keyword.KeywordKind.Meta]],
    ["o", [Keyword.KeywordKind.Or]],
]);
