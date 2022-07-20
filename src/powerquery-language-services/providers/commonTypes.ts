// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { CommonError, ICancellationToken, Result } from "@microsoft/powerquery-parser";
import type {
    FoldingRange,
    Hover,
    Location,
    Range,
    SemanticTokenModifiers,
    SemanticTokenTypes,
    SignatureHelp,
} from "vscode-languageserver-types";
import { TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import type { Autocomplete } from "../inspection";
import type { AutocompleteItem } from "../inspection/autocomplete/autocompleteItem";
import type { ILibrary } from "../library/library";
import { Inspection } from "..";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

export interface IAutocompleteItemProvider {
    getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<AutocompleteItem[] | undefined, CommonError.CommonError>>;
}

export interface AutocompleteItemProviderContext extends ProviderContext {
    readonly autocomplete: Autocomplete;
    readonly triedNodeScope: Inspection.TriedNodeScope;
    readonly triedScopeType: Inspection.TriedScopeType;
    readonly text?: string;
    readonly tokenKind?: string;
}

export interface IDefinitionProvider {
    getDefinition(
        context: OnIdentifierProviderContext,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>>;
}

export interface DefinitionProviderContext extends ProviderContext {
    readonly identifier: Ast.GeneralizedIdentifier | Ast.Identifier;
    readonly triedNodeScope: Inspection.TriedNodeScope;
}

export interface IFoldingRangeProvider {
    getFoldingRanges(context: FoldingRangeContext): Promise<Result<FoldingRange[], CommonError.CommonError>>;
}

export interface FoldingRangeContext extends ProviderContext {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
}

export interface IHoverProvider {
    getHover(context: OnIdentifierProviderContext): Promise<Hover | null>;
}

export interface ILocalDocumentProvider
    extends IDefinitionProvider,
        IFoldingRangeProvider,
        ISemanticTokenProvider,
        ISymbolProvider {}

export interface ISemanticTokenProvider {
    getPartialSemanticTokens(context: ProviderContext): Promise<PartialSemanticToken[]>;
}

export interface ProviderContext {
    readonly traceManager: TraceManager;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly range?: Range;
}

export interface OnIdentifierProviderContext extends ProviderContext {
    readonly identifier: Ast.GeneralizedIdentifier | Ast.Identifier;
}

// Almost the same interface as the parameters to a `SemanticTokensBuilder.push` function overload,
// except tokenType isn't a string nor is tokenModifiers a string array.
export interface PartialSemanticToken {
    readonly range: Range;
    readonly tokenType: SemanticTokenTypes;
    readonly tokenModifiers: ReadonlyArray<SemanticTokenModifiers>;
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

export interface ISymbolProvider extends IAutocompleteItemProvider, IHoverProvider, SignatureHelpProvider, ILibrary {}
