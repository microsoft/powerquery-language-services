// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, Range, SignatureHelp } from "vscode-languageserver-types";
import { ILibrary } from "../library";

export interface CompletionItemProvider {
    getCompletionItems(context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>>;
}

export interface CompletionItemProviderContext extends ProviderContext {
    readonly text?: string;
    readonly tokenKind?: string;
}

export interface HoverProvider {
    getHover(context: HoverProviderContext): Promise<Hover | null>;
}

export interface HoverProviderContext extends ProviderContext {
    readonly identifier: string;
}

// Lookup provider for built-in and external libaries/modules.
export interface LibraryProvider extends CompletionItemProvider, HoverProvider, SignatureHelpProvider, ILibrary {}

export interface ProviderContext {
    readonly range?: Range;
}

export interface SignatureHelpProvider {
    getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

export interface SignatureProviderContext extends ProviderContext {
    readonly argumentOrdinal: number | undefined;
    readonly functionName: string | undefined;
}

export interface SymbolProvider extends CompletionItemProvider, HoverProvider, SignatureHelpProvider {}
