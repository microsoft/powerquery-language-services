// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "@microsoft/powerquery-parser";

import {
    AutocompleteItemProviderContext,
    Hover,
    HoverProviderContext,
    Inspection,
    LibraryProvider,
    SignatureHelp,
    SignatureProviderContext,
} from "../../powerquery-language-services";
import { ILibrary } from "../../powerquery-language-services/library/library";

export class SlowLibraryProvider extends LibraryProvider {
    private readonly delayInMs: number;

    constructor(library: ILibrary, locale: string, delayInMs: number) {
        super(library, locale);
        this.delayInMs = delayInMs;
    }

    public override async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getAutocompleteItems(context);
    }

    public override async getHover(
        context: HoverProviderContext,
    ): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getHover(context);
    }

    public override async getSignatureHelp(
        context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getSignatureHelp(context);
    }

    private delay(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
            setTimeout(() => {
                resolve();
            }, this.delayInMs);
        });
    }
}
