// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { FoldingRange, Location } from "vscode-languageserver-types";

import {
    AutocompleteItemProviderContext,
    DefinitionProviderContext,
    HoverProviderContext,
    PartialSemanticToken,
    ProviderContext,
    SignatureProviderContext,
} from "./commonTypes";
import {
    IAutocompleteItemProvider,
    IDefinitionProvider,
    IFoldingRangeProvider,
    IHoverProvider,
    ISemanticTokenProvider,
    ISignatureHelpProvider,
} from "../providers";

import { ExternalType, Library } from "..";
import { Hover, SignatureHelp } from "../commonTypes";

import { AutocompleteItem } from "../inspection/autocomplete";

export class NullSymbolProvider
    implements
        IAutocompleteItemProvider,
        IDefinitionProvider,
        IFoldingRangeProvider,
        IHoverProvider,
        ISemanticTokenProvider,
        ISignatureHelpProvider
{
    public readonly externalTypeResolver: ExternalType.TExternalTypeResolverFn = ExternalType.noOpExternalTypeResolver;
    public readonly libraryDefinitions: Library.LibraryDefinitions = new Map();

    private static instance: NullSymbolProvider | undefined;

    public static singleton(): NullSymbolProvider {
        if (NullSymbolProvider.instance === undefined) {
            NullSymbolProvider.instance = new NullSymbolProvider();
        }

        return NullSymbolProvider.instance;
    }

    // eslint-disable-next-line require-await
    public async getAutocompleteItems(
        _context: AutocompleteItemProviderContext,
    ): Promise<Result<AutocompleteItem[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ok(undefined);
    }

    // eslint-disable-next-line require-await
    public async getDefinition(
        _context: DefinitionProviderContext,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ok(undefined);
    }

    // eslint-disable-next-line require-await
    public async getFoldingRanges(_context: ProviderContext): Promise<Result<FoldingRange[], CommonError.CommonError>> {
        return ResultUtils.ok([]);
    }

    // eslint-disable-next-line require-await
    public async getHover(_context: HoverProviderContext): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        return ResultUtils.ok(undefined);
    }

    // eslint-disable-next-line require-await
    public async getPartialSemanticTokens(
        _context: ProviderContext,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ok(undefined);
    }

    // eslint-disable-next-line require-await
    public async getSignatureHelp(
        _context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        return ResultUtils.ok(undefined);
    }
}
