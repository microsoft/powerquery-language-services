// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AutocompleteItemProviderContext,
    IdentifierProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";
import { Hover, SignatureHelp } from "../commonTypes";
import { Inspection, Library } from "..";
import { AutocompleteItem } from "../inspection/autocomplete";

export class NullSymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn =
        Inspection.ExternalType.noOpExternalTypeResolver;
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
    ): Promise<ReadonlyArray<AutocompleteItem>> {
        return [];
    }

    // eslint-disable-next-line require-await
    public async getHover(_context: IdentifierProviderContext): Promise<Hover | null> {
        return null;
    }

    // eslint-disable-next-line require-await
    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        return null;
    }
}
