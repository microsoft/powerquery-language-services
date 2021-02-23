// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";

import { TrailingToken } from "../commonTypes";

export function autocompleteKeywordTrailingText(
    inspected: ReadonlyArray<PQP.Language.Keyword.KeywordKind>,
    trailingToken: TrailingToken,
    maybeAllowedKeywords: ReadonlyArray<PQP.Language.Keyword.KeywordKind> | undefined,
): ReadonlyArray<PQP.Language.Keyword.KeywordKind> {
    if (trailingToken.isInOrOnPosition === false) {
        return inspected;
    }
    Assert.isTrue(trailingToken.data.length > 0, "trailingToken.data.length > 0");
    const token: PQP.Language.Token.Token = trailingToken;

    maybeAllowedKeywords = maybeAllowedKeywords ?? PartialConjunctionKeywordAutocompleteMap.get(token.data[0]);

    if (maybeAllowedKeywords !== undefined) {
        return PQP.ArrayUtils.concatUnique(
            inspected,
            maybeAllowedKeywords.filter((keyword: PQP.Language.Keyword.KeywordKind) => keyword.startsWith(token.data)),
        );
    } else {
        return inspected;
    }
}

// Used with maybeParseError to see if a user could be typing a conjunctive keyword such as 'or'. Eg.
// 'Details[UserName] <> "" o|'
const PartialConjunctionKeywordAutocompleteMap: Map<string, ReadonlyArray<PQP.Language.Keyword.KeywordKind>> = new Map<
    string,
    ReadonlyArray<PQP.Language.Keyword.KeywordKind>
>([
    ["a", [PQP.Language.Keyword.KeywordKind.And, PQP.Language.Keyword.KeywordKind.As]],
    ["i", [PQP.Language.Keyword.KeywordKind.Is]],
    ["m", [PQP.Language.Keyword.KeywordKind.Meta]],
    ["o", [PQP.Language.Keyword.KeywordKind.Or]],
]);
