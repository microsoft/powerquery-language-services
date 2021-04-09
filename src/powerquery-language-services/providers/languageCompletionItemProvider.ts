// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Inspection } from "..";
import { AutocompleteItem } from "../inspection/autocomplete/autocompleteItem";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { AutocompleteItemProvider, AutocompleteItemProviderContext } from "./commonTypes";

export class LanguageAutocompleteItemProvider implements AutocompleteItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<string> = [
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

    public async getAutocompleteItems(
        _context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<AutocompleteItem>> {
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

    private getKeywords(
        triedKeywordAutocomplete: Inspection.TriedAutocompleteKeyword,
    ): ReadonlyArray<AutocompleteItem> {
        if (PQP.ResultUtils.isError(triedKeywordAutocomplete)) {
            return [];
        }

        return triedKeywordAutocomplete.value.filter(
            (autocompleteItem: AutocompleteItem) =>
                LanguageAutocompleteItemProvider.ExcludedKeywords.includes(autocompleteItem.label) === false,
        );
    }

    private getLanguageConstants(
        triedLanguageConstantAutocomplete: Inspection.TriedAutocompleteLanguageConstant,
    ): ReadonlyArray<AutocompleteItem> {
        return PQP.ResultUtils.isOk(triedLanguageConstantAutocomplete) && triedLanguageConstantAutocomplete.value
            ? [triedLanguageConstantAutocomplete.value]
            : [];
    }

    private getPrimitiveTypes(
        triedPrimitiveTypeAutocomplete: Inspection.TriedAutocompletePrimitiveType,
    ): ReadonlyArray<AutocompleteItem> {
        return PQP.ResultUtils.isOk(triedPrimitiveTypeAutocomplete) && triedPrimitiveTypeAutocomplete.value
            ? triedPrimitiveTypeAutocomplete.value
            : [];
    }
}
