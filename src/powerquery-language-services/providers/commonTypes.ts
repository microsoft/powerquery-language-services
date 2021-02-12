// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { CompletionItem, Hover, Range, SignatureHelp } from "vscode-languageserver-types";
import { ILibrary } from "../library/library";

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

export interface ProviderContext {
    readonly range?: Range;
}

export interface SignatureHelpProvider {
    getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

export interface SignatureProviderContext extends ProviderContext {
    readonly argumentOrdinal: number | undefined;
    readonly functionName: string | undefined;
    readonly type: PQP.Language.Type.TType;
}

export interface ISymbolProvider extends CompletionItemProvider, HoverProvider, SignatureHelpProvider, ILibrary {}
