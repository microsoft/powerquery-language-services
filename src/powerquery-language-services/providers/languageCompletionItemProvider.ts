// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ICancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";
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

        context.maybeCancellationToken?.throwIfCancelled();

        const autocomplete: Inspection.Autocomplete = context.autocomplete;

        const autocompleteItems: Inspection.AutocompleteItem[] = [
            ...this.getKeywords(autocomplete.triedKeyword, context.maybeCancellationToken),
            ...this.getLanguageConstants(autocomplete.triedLanguageConstant, context.maybeCancellationToken),
            ...this.getPrimitiveTypes(autocomplete.triedPrimitiveType, context.maybeCancellationToken),
        ];

        trace.exit();

        return Promise.resolve(ResultUtils.boxOk(autocompleteItems));
    }

    private getKeywords(
        triedKeywordAutocomplete: Inspection.TriedAutocompleteKeyword,
        maybeCancellationToken: ICancellationToken | undefined,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        maybeCancellationToken?.throwIfCancelled();

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
        maybeCancellationToken: ICancellationToken | undefined,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        maybeCancellationToken?.throwIfCancelled();

        return ResultUtils.isOk(triedLanguageConstantAutocomplete) && triedLanguageConstantAutocomplete.value
            ? [triedLanguageConstantAutocomplete.value]
            : [];
    }

    private getPrimitiveTypes(
        triedPrimitiveTypeAutocomplete: Inspection.TriedAutocompletePrimitiveType,
        maybeCancellationToken: ICancellationToken | undefined,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        maybeCancellationToken?.throwIfCancelled();

        return ResultUtils.isOk(triedPrimitiveTypeAutocomplete) && triedPrimitiveTypeAutocomplete.value
            ? triedPrimitiveTypeAutocomplete.value
            : [];
    }
}
