// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, SignatureHelp } from "../commonTypes";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    LibrarySymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";

export class NullLibrarySymbolProvider implements LibrarySymbolProvider {
    private static instance: NullLibrarySymbolProvider | undefined;

    public static singleton(): NullLibrarySymbolProvider {
        if (NullLibrarySymbolProvider.instance === undefined) {
            NullLibrarySymbolProvider.instance = new NullLibrarySymbolProvider();
        }

        return NullLibrarySymbolProvider.instance;
    }

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
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

    public includeModules(_modules: string[]): void {
        // No impact
    }
}
