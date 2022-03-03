// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { KeywordKind } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/keyword/keyword";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { AutocompleteItemProvider, AutocompleteItemProviderContext } from "./commonTypes";
import { AutocompleteItem } from "../inspection/autocomplete/autocompleteItem";
import { Inspection } from "..";

export class LanguageAutocompleteItemProvider implements AutocompleteItemProvider {
    // Power Query defines constructor functions (ex. #table()) as keywords, but we want
    // them to be treated like library functions instead.
    private static readonly ExcludedKeywords: ReadonlyArray<string> = [
        KeywordKind.HashBinary,
        KeywordKind.HashDate,
        KeywordKind.HashDateTime,
        KeywordKind.HashDateTimeZone,
        KeywordKind.HashDuration,
        KeywordKind.HashInfinity,
        KeywordKind.HashNan,
        KeywordKind.HashSections,
        KeywordKind.HashShared,
        KeywordKind.HashTable,
        KeywordKind.HashTime,
    ];

    constructor(private readonly maybePromiseInspection: Promise<Inspection.Inspection | undefined>) {}

    // eslint-disable-next-line require-await
    public async getAutocompleteItems(
        _context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<AutocompleteItem>> {
        const maybeInspection: Inspection.Inspection | undefined = await this.maybePromiseInspection;

        if (maybeInspection === undefined) {
            return [];
        }

        const autocomplete: Inspection.Autocomplete = maybeInspection.autocomplete;

        return [
            ...this.getKeywords(autocomplete.triedKeyword),
            ...this.getLanguageConstants(autocomplete.triedLanguageConstant),
            ...this.getPrimitiveTypes(autocomplete.triedPrimitiveType),
        ];
    }

    private getKeywords(
        triedKeywordAutocomplete: Inspection.TriedAutocompleteKeyword,
    ): ReadonlyArray<AutocompleteItem> {
        if (ResultUtils.isError(triedKeywordAutocomplete)) {
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
        return ResultUtils.isOk(triedLanguageConstantAutocomplete) && triedLanguageConstantAutocomplete.value
            ? [triedLanguageConstantAutocomplete.value]
            : [];
    }

    private getPrimitiveTypes(
        triedPrimitiveTypeAutocomplete: Inspection.TriedAutocompletePrimitiveType,
    ): ReadonlyArray<AutocompleteItem> {
        return ResultUtils.isOk(triedPrimitiveTypeAutocomplete) && triedPrimitiveTypeAutocomplete.value
            ? triedPrimitiveTypeAutocomplete.value
            : [];
    }
}
