// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Hover, Location, Range, SignatureHelp } from "vscode-languageserver-types";
import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import type { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import type { AutocompleteItem } from "../inspection/autocomplete/autocompleteItem";
import type { ILibrary } from "../library/library";

export interface AutocompleteItemProvider {
    getAutocompleteItems(context: AutocompleteItemProviderContext): Promise<ReadonlyArray<AutocompleteItem>>;
}

export interface AutocompleteItemProviderContext extends ProviderContext {
    readonly text?: string;
    readonly tokenKind?: string;
}

export interface DefinitionProvider {
    getDefinition(context: IdentifierProviderContext): Promise<Location[] | null>;
}

export interface HoverProvider {
    getHover(context: IdentifierProviderContext): Promise<Hover | null>;
}

export interface IdentifierProviderContext extends ProviderContext {
    readonly identifier: string;
}

export interface ProviderContext {
    readonly traceManager: TraceManager;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly range?: Range;
}

export interface SignatureHelpProvider {
    getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

export interface SignatureProviderContext extends ProviderContext {
    readonly argumentOrdinal: number | undefined;
    readonly functionName: string | undefined;
    readonly isNameInLocalScope: boolean;
    readonly functionType: Type.TPowerQueryType;
}

export interface ISymbolProvider
    extends AutocompleteItemProvider,
        DefinitionProvider,
        HoverProvider,
        SignatureHelpProvider,
        ILibrary {}
