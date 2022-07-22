// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "@microsoft/powerquery-parser";

import {
    AutocompleteItemProviderContext,
    Inspection,
    LanguageAutocompleteItemProvider,
} from "../../powerquery-language-services";

export class SlowLanguageAutocompleteItemProvider extends LanguageAutocompleteItemProvider {
    constructor(private readonly delayInMs: number) {
        super();
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
