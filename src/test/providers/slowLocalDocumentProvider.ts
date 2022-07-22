// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result } from "@microsoft/powerquery-parser";
import { FoldingRange, Location } from "vscode-languageserver-types";

import {
    AutocompleteItemProviderContext,
    DefinitionProviderContext,
    FoldingRangeProviderContext,
    Hover,
    HoverProviderContext,
    Inspection,
    LocalDocumentProvider,
    PartialSemanticToken,
    SemanticTokenProviderContext,
    SignatureHelp,
    SignatureProviderContext,
} from "../../powerquery-language-services";
import { ILibrary } from "../../powerquery-language-services/library/library";
import { TypeCache } from "../../powerquery-language-services/inspection";

export class SlowLocalDocumentProvider extends LocalDocumentProvider {
    constructor(uri: string, typeCache: TypeCache, library: ILibrary, private readonly delayInMs: number) {
        super(uri, typeCache, library);
    }

    public override async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getAutocompleteItems(context);
    }

    public override async getDefinition(
        context: DefinitionProviderContext,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getDefinition(context);
    }

    public override async getFoldingRanges(
        context: FoldingRangeProviderContext,
    ): Promise<Result<FoldingRange[], CommonError.CommonError>> {
        await this.delay();

        return super.getFoldingRanges(context);
    }

    public override async getHover(
        context: HoverProviderContext,
    ): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getHover(context);
    }

    public override async getPartialSemanticTokens(
        context: SemanticTokenProviderContext,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
        await this.delay();

        return super.getPartialSemanticTokens(context);
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
