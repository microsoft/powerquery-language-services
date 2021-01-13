// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItem, CompletionItemKind } from "./commonTypes";
import { CompletionItemProvider, CompletionItemProviderContext } from "./providers";
import * as WorkspaceCache from "./workspaceCache";

export class LanguageProvider implements CompletionItemProvider {
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

    constructor(private readonly maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined) {}

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        if (
            this.maybeTriedInspection === undefined ||
            this.maybeTriedInspection.kind === PQP.ResultKind.Err ||
            this.maybeTriedInspection.stage !== WorkspaceCache.CacheStageKind.Inspection
        ) {
            return [];
        }

        const autocomplete: PQP.Inspection.Autocomplete = this.maybeTriedInspection.value.autocomplete;

        return [
            ...this.getFieldAccess(autocomplete.triedFieldAccess),
            ...this.getKeywords(autocomplete.triedKeyword),
            ...this.getLanguageConstants(autocomplete.triedLanguageConstant),
            ...this.getPrimitiveTypes(autocomplete.triedPrimitiveType),
        ];
    }

    private getFieldAccess(
        triedFieldAccessAutocomplete: PQP.Inspection.TriedAutocompleteFieldAccess,
    ): CompletionItem[] {
        if (PQP.ResultUtils.isErr(triedFieldAccessAutocomplete) || triedFieldAccessAutocomplete.value === undefined) {
            return [];
        }

        return triedFieldAccessAutocomplete.value.autocompleteItems.map(
            (autocompleteItem: PQP.Inspection.AutocompleteItem) => {
                return {
                    kind: CompletionItemKind.Field,
                    label: autocompleteItem.key,
                };
            },
        );
    }

    private getKeywords(triedKeywordAutocomplete: PQP.Inspection.TriedAutocompleteKeyword): CompletionItem[] {
        if (PQP.ResultUtils.isErr(triedKeywordAutocomplete)) {
            return [];
        }

        return triedKeywordAutocomplete.value
            .filter(
                (keywordKind: PQP.Language.Keyword.KeywordKind) =>
                    LanguageProvider.ExcludedKeywords.includes(keywordKind) === false,
            )
            .map((keywordKind: PQP.Language.Keyword.KeywordKind) => {
                return {
                    kind: CompletionItemKind.Keyword,
                    label: keywordKind,
                };
            });
    }

    private getLanguageConstants(
        triedLanguageConstantAutocomplete: PQP.Inspection.TriedAutocompleteLanguageConstant,
    ): CompletionItem[] {
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
        triedPrimitiveTypeAutocomplete: PQP.Inspection.TriedAutocompletePrimitiveType,
    ): CompletionItem[] {
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
