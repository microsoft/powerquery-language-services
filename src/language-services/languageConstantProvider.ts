// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import { CompletionItemProvider, CompletionItemProviderContext } from "./providers";

export class LanguageConstantProvider implements CompletionItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<PQP.Language.KeywordKind> = [
        PQP.Language.KeywordKind.HashBinary,
        PQP.Language.KeywordKind.HashDate,
        PQP.Language.KeywordKind.HashDateTime,
        PQP.Language.KeywordKind.HashDateTimeZone,
        PQP.Language.KeywordKind.HashDuration,
        PQP.Language.KeywordKind.HashInfinity,
        PQP.Language.KeywordKind.HashNan,
        PQP.Language.KeywordKind.HashSections,
        PQP.Language.KeywordKind.HashShared,
        PQP.Language.KeywordKind.HashTable,
        PQP.Language.KeywordKind.HashTime,
    ];

    constructor(private readonly maybeTriedInspection: PQP.Task.TriedInspection | undefined) {}

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        if (this.maybeTriedInspection === undefined || PQP.ResultUtils.isErr(this.maybeTriedInspection)) {
            return [];
        }
        const inspectionOk: PQP.Task.InspectionOk = this.maybeTriedInspection.value;

        return inspectionOk.autocomplete
            .filter(
                (keyword: PQP.Language.KeywordKind) =>
                    LanguageConstantProvider.ExcludedKeywords.indexOf(keyword) === -1,
            )
            .map((keyword: PQP.Language.KeywordKind) => {
                return {
                    kind: CompletionItemKind.Keyword,
                    label: keyword,
                };
            });
    }
}
