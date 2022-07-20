// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { KeywordKind } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/keyword/keyword";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { AutocompleteItemProviderContext, IAutocompleteItemProvider } from "./commonTypes";
import { Inspection } from "..";
import { ProviderTraceConstant } from "../trace";

export class LanguageAutocompleteItemProvider implements IAutocompleteItemProvider {
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

    public getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LanguageCompletionProvider,
            this.getAutocompleteItems.name,
            context.maybeInitialCorrelationId,
        );

        const autocomplete: Inspection.Autocomplete = context.autocomplete;

        const autocompleteItems: Inspection.AutocompleteItem[] = [
            ...this.getKeywords(autocomplete.triedKeyword),
            ...this.getLanguageConstants(autocomplete.triedLanguageConstant),
            ...this.getPrimitiveTypes(autocomplete.triedPrimitiveType),
        ];

        trace.exit();

        return Promise.resolve(ResultUtils.boxOk(autocompleteItems));
    }

    private getKeywords(
        triedKeywordAutocomplete: Inspection.TriedAutocompleteKeyword,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        if (ResultUtils.isError(triedKeywordAutocomplete)) {
            return [];
        }

        return triedKeywordAutocomplete.value.filter(
            (autocompleteItem: Inspection.AutocompleteItem) =>
                LanguageAutocompleteItemProvider.ExcludedKeywords.includes(autocompleteItem.label) === false,
        );
    }

    private getLanguageConstants(
        triedLanguageConstantAutocomplete: Inspection.TriedAutocompleteLanguageConstant,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.isOk(triedLanguageConstantAutocomplete) && triedLanguageConstantAutocomplete.value
            ? [triedLanguageConstantAutocomplete.value]
            : [];
    }

    private getPrimitiveTypes(
        triedPrimitiveTypeAutocomplete: Inspection.TriedAutocompletePrimitiveType,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.isOk(triedPrimitiveTypeAutocomplete) && triedPrimitiveTypeAutocomplete.value
            ? triedPrimitiveTypeAutocomplete.value
            : [];
    }
}
