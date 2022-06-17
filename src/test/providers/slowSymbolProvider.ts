// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AutocompleteItemProviderContext,
    Hover,
    IdentifierProviderContext,
    Library,
    LibrarySymbolProvider,
    SignatureHelp,
    SignatureProviderContext,
} from "../../powerquery-language-services";
import { AutocompleteItem } from "../../powerquery-language-services/inspection";

export class SlowSymbolProvider extends LibrarySymbolProvider {
    private readonly delayInMS: number;

    constructor(library: Library.ILibrary, delayInMS: number) {
        super(library);
        this.delayInMS = delayInMS;
    }

    public override async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<AutocompleteItem>> {
        await this.delay();

        return super.getAutocompleteItems(context);
    }

    public override async getHover(context: IdentifierProviderContext): Promise<Hover | null> {
        await this.delay();

        return super.getHover(context);
    }

    public override async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        await this.delay();

        return super.getSignatureHelp(context);
    }

    private delay(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
            setTimeout(() => {
                resolve();
            }, this.delayInMS);
        });
    }
}
