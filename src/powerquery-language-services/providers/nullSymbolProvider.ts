// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection, Library } from "..";
import { Hover, SignatureHelp } from "../commonTypes";
import { AutocompleteItem } from "../inspection/autocomplete";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";

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

    public async getAutocompleteItems(
        _context: CompletionItemProviderContext,
    ): Promise<ReadonlyArray<AutocompleteItem>> {
        return [];
    }

    public async getHover(_context: HoverProviderContext): Promise<Hover | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }
}
