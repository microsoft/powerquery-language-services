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

    constructor(protected readonly locale: string) {}

    public async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        // eslint-disable-next-line require-await
        return await ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LanguageCompletionProvider,
                this.getAutocompleteItems.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            const autocomplete: Inspection.Autocomplete = context.autocomplete;

            const autocompleteItems: Inspection.AutocompleteItem[] = [
                ...this.getKeywords(autocomplete.triedKeyword, context.cancellationToken),
                ...this.getLanguageConstants(autocomplete.triedLanguageConstant, context.cancellationToken),
                ...this.getPrimitiveTypes(autocomplete.triedPrimitiveType, context.cancellationToken),
            ];

            trace.exit();

            return autocompleteItems;
        }, this.locale);
    }

    private getKeywords(
        triedKeywordAutocomplete: Inspection.TriedAutocompleteKeyword,
        cancellationToken: ICancellationToken | undefined,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        cancellationToken?.throwIfCancelled();

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
        cancellationToken: ICancellationToken | undefined,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        cancellationToken?.throwIfCancelled();

        return ResultUtils.isOk(triedLanguageConstantAutocomplete) ? triedLanguageConstantAutocomplete.value : [];
    }

    private getPrimitiveTypes(
        triedPrimitiveTypeAutocomplete: Inspection.TriedAutocompletePrimitiveType,
        cancellationToken: ICancellationToken | undefined,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        cancellationToken?.throwIfCancelled();

        return ResultUtils.isOk(triedPrimitiveTypeAutocomplete) && triedPrimitiveTypeAutocomplete.value
            ? triedPrimitiveTypeAutocomplete.value
            : [];
    }
}
