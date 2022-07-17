// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { FoldingRange, Location } from "vscode-languageserver-types";

import {
    AutocompleteItemProviderContext,
    Hover,
    IDefinitionProvider,
    IFoldingRangeProvider,
    ISemanticTokenProvider,
    Library,
    LibrarySymbolProvider,
    OnIdentifierProviderContext,
    PartialSemanticToken,
    ProviderContext,
    SignatureHelp,
    SignatureProviderContext,
} from "../../powerquery-language-services";
import { AutocompleteItem } from "../../powerquery-language-services/inspection";

export class SlowSymbolProvider
    extends LibrarySymbolProvider
    implements IDefinitionProvider, IFoldingRangeProvider, ISemanticTokenProvider
{
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

    // eslint-disable-next-line require-await
    public async getDefinition(_context: OnIdentifierProviderContext): Promise<Location[] | null> {
        throw new Error("Method not implemented.");
    }

    public override async getHover(context: OnIdentifierProviderContext): Promise<Hover | null> {
        await this.delay();

        return super.getHover(context);
    }

    // eslint-disable-next-line require-await
    public async getFoldingRanges(_context: ProviderContext): Promise<FoldingRange[]> {
        throw new Error("Method not implemented.");
    }

    // eslint-disable-next-line require-await
    public async getPartialSemanticTokens(_context: ProviderContext): Promise<PartialSemanticToken[]> {
        throw new Error("Method not implemented.");
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
