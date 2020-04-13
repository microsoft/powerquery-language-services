// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import { CompletionItemProvider, CompletionItemProviderContext } from "./providers";

export class KeywordProvider implements CompletionItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<PQP.KeywordKind> = [
        PQP.KeywordKind.HashBinary,
        PQP.KeywordKind.HashDate,
        PQP.KeywordKind.HashDateTime,
        PQP.KeywordKind.HashDateTimeZone,
        PQP.KeywordKind.HashDuration,
        PQP.KeywordKind.HashInfinity,
        PQP.KeywordKind.HashNan,
        PQP.KeywordKind.HashSections,
        PQP.KeywordKind.HashShared,
        PQP.KeywordKind.HashTable,
        PQP.KeywordKind.HashTime,
    ];

    constructor(private readonly maybeTriedInspection: undefined | PQP.Task.TriedInspection) {}

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        if (this.maybeTriedInspection === undefined || PQP.ResultUtils.isErr(this.maybeTriedInspection)) {
            return [];
        }
        const inspectionOk: PQP.Task.InspectionOk = this.maybeTriedInspection.value;

        return inspectionOk.autocomplete
            .filter((keyword: PQP.KeywordKind) => KeywordProvider.ExcludedKeywords.indexOf(keyword) === -1)
            .map((keyword: PQP.KeywordKind) => {
                return {
                    kind: CompletionItemKind.Keyword,
                    label: keyword,
                };
            });
    }
}
