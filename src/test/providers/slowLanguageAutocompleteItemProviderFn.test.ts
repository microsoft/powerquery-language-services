// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type CommonError, type Result } from "@microsoft/powerquery-parser";

import {
    type AutocompleteItemProviderContext,
    type Inspection,
    LanguageAutocompleteItemProvider,
} from "../../powerquery-language-services";

export class SlowLanguageAutocompleteItemProvider extends LanguageAutocompleteItemProvider {
    private readonly delayInMs: number;

    constructor(locale: string, delayInMs: number) {
        super(locale);
        this.delayInMs = delayInMs;
    }

    public override async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getAutocompleteItems(context);
    }

    private delay(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
            setTimeout(() => {
                resolve();
            }, this.delayInMs);
        });
    }
}
