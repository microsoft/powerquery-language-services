// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";
import { CompletionItem, CompletionItemKind } from "../commonTypes";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { CompletionItemProvider, CompletionItemProviderContext } from "./commonTypes";

export class LanguageCompletionItemProvider implements CompletionItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<PQP.Language.Keyword.KeywordKind> = [
        PQP.Language.Keyword.KeywordKind.HashBinary,
        PQP.Language.Keyword.KeywordKind.HashDate,
        PQP.Language.Keyword.KeywordKind.HashDateTime,
        PQP.Language.Keyword.KeywordKind.HashDateTimeZone,
        PQP.Language.Keyword.KeywordKind.HashDuration,
        PQP.Language.Keyword.KeywordKind.HashInfinity,
        PQP.Language.Keyword.KeywordKind.HashNan,
        PQP.Language.Keyword.KeywordKind.HashSections,
        PQP.Language.Keyword.KeywordKind.HashShared,
        PQP.Language.Keyword.KeywordKind.HashTable,
        PQP.Language.Keyword.KeywordKind.HashTime,
    ];

    constructor(private readonly maybeTriedInspection: WorkspaceCache.InspectionCacheItem) {}

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
        if (!WorkspaceCacheUtils.isInspectionTask(this.maybeTriedInspection)) {
            return [];
        }

        const autocomplete: Inspection.Autocomplete = this.maybeTriedInspection.autocomplete;

        return [
            ...this.getKeywords(autocomplete.triedKeyword),
            ...this.getLanguageConstants(autocomplete.triedLanguageConstant),
            ...this.getPrimitiveTypes(autocomplete.triedPrimitiveType),
        ];
    }

    private getKeywords(triedKeywordAutocomplete: Inspection.TriedAutocompleteKeyword): ReadonlyArray<CompletionItem> {
        if (PQP.ResultUtils.isErr(triedKeywordAutocomplete)) {
            return [];
        }

        return triedKeywordAutocomplete.value
            .filter(
                (keywordKind: PQP.Language.Keyword.KeywordKind) =>
                    LanguageCompletionItemProvider.ExcludedKeywords.includes(keywordKind) === false,
            )
            .map((keywordKind: PQP.Language.Keyword.KeywordKind) => {
                return {
                    kind: CompletionItemKind.Keyword,
                    label: keywordKind,
                };
            });
    }

    private getLanguageConstants(
        triedLanguageConstantAutocomplete: Inspection.TriedAutocompleteLanguageConstant,
    ): ReadonlyArray<CompletionItem> {
        if (
            PQP.ResultUtils.isErr(triedLanguageConstantAutocomplete) ||
            triedLanguageConstantAutocomplete.value === undefined
        ) {
            return [];
        }

        return [
            {
                kind: CompletionItemKind.Keyword,
                label: triedLanguageConstantAutocomplete.value,
            },
        ];
    }

    private getPrimitiveTypes(
        triedPrimitiveTypeAutocomplete: Inspection.TriedAutocompletePrimitiveType,
    ): ReadonlyArray<CompletionItem> {
        if (PQP.ResultUtils.isErr(triedPrimitiveTypeAutocomplete)) {
            return [];
        }

        return triedPrimitiveTypeAutocomplete.value.map(
            (keywordKind: PQP.Language.Constant.PrimitiveTypeConstantKind) => {
                return {
                    kind: CompletionItemKind.Reference,
                    label: keywordKind,
                };
            },
        );
    }
}
