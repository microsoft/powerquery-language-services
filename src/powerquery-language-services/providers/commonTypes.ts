// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Hover, Range, SignatureHelp } from "vscode-languageserver-types";

import type { AutocompleteItem } from "../inspection/autocomplete/autocompleteItem";
import type { ILibrary } from "../library/library";

export interface AutocompleteItemProvider {
    getAutocompleteItems(context: AutocompleteItemProviderContext): Promise<ReadonlyArray<AutocompleteItem>>;
}

export interface AutocompleteItemProviderContext extends ProviderContext {
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
    readonly isNameInLocalScope: boolean;
    readonly functionType: PQP.Language.Type.PowerQueryType;
}

export interface ISymbolProvider extends AutocompleteItemProvider, HoverProvider, SignatureHelpProvider, ILibrary {}
