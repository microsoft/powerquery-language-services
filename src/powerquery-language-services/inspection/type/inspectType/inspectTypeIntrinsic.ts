// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

const FunctionIntrinsicIdentifiers: ReadonlySet<string> = new Set([
    Keyword.KeywordKind.HashBinary,
    Keyword.KeywordKind.HashDate,
    Keyword.KeywordKind.HashDateTime,
    Keyword.KeywordKind.HashDateTimeZone,
    Keyword.KeywordKind.HashDuration,
    Keyword.KeywordKind.HashTable,
    Keyword.KeywordKind.HashTime,
]);

export function intrinsicIdentifierType(identifierLiteral: string): Type.TPowerQueryType | undefined {
    return FunctionIntrinsicIdentifiers.has(identifierLiteral) ? Type.FunctionInstance : undefined;
}
