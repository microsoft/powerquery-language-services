// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type Ast, type Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { type CommonError, type ICancellationToken, type Result } from "@microsoft/powerquery-parser";
import {
    type FoldingRange,
    type Hover,
    type Location,
    type Range,
    type SemanticTokenModifiers,
    type SemanticTokenTypes,
    type SignatureHelp,
} from "vscode-languageserver-types";
import { type NodeIdMap, type ParseState } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { type Autocomplete, type TriedCurrentInvokeExpression } from "../inspection";
import { type Inspection, type InspectionSettings } from "..";
import { type AutocompleteItem } from "../inspection/autocomplete/autocompleteItem";
import { type ILibrary } from "../library/library";

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
    getDefinition(context: DefinitionProviderContext): Promise<Result<Location[] | undefined, CommonError.CommonError>>;
}

export interface DefinitionProviderContext extends ProviderContext {
    readonly identifier: Ast.GeneralizedIdentifier | Ast.Identifier;
    readonly triedNodeScope: Inspection.TriedNodeScope;
}

export interface IFoldingRangeProvider {
    getFoldingRanges(context: FoldingRangeProviderContext): Promise<Result<FoldingRange[], CommonError.CommonError>>;
}

export interface FoldingRangeProviderContext extends ProviderContext {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
}

export interface IHoverProvider {
    getHover(context: HoverProviderContext): Promise<Result<Hover | undefined, CommonError.CommonError>>;
}

export interface HoverProviderContext extends ProviderContext {
    readonly activeNode: Inspection.ActiveNode;
    readonly identifier: Ast.GeneralizedIdentifier | Ast.Identifier;
    readonly inspectionSettings: InspectionSettings;
    readonly parseState: ParseState;
    readonly triedNodeScope: Inspection.TriedNodeScope;
    readonly triedScopeType: Inspection.TriedScopeType;
}

export interface ISemanticTokenProvider {
    getPartialSemanticTokens(
        context: SemanticTokenProviderContext,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>>;
}

export interface SemanticTokenProviderContext extends ProviderContext {
    readonly parseState: ParseState;
    readonly library: ILibrary;
}

export interface ProviderContext {
    readonly traceManager: TraceManager;
    readonly initialCorrelationId: number | undefined;
    readonly cancellationToken: ICancellationToken | undefined;
    readonly range?: Range;
}

// Almost the same interface as the parameters to a `SemanticTokensBuilder.push` function overload,
// except tokenType isn't a string nor is tokenModifiers a string array.
export interface PartialSemanticToken {
    readonly range: Range;
    readonly tokenType: SemanticTokenTypes;
    readonly tokenModifiers: ReadonlyArray<SemanticTokenModifiers>;
}

export interface ISignatureHelpProvider {
    getSignatureHelp(
        context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>>;
}

export interface SignatureProviderContext extends ProviderContext {
    readonly argumentOrdinal: number | undefined;
    readonly functionName: string | undefined;
    readonly isNameInLocalScope: boolean;
    readonly functionType: Type.TPowerQueryType;
    readonly triedCurrentInvokeExpression: TriedCurrentInvokeExpression;
}

export interface ILibraryProvider extends IAutocompleteItemProvider, IHoverProvider, ISignatureHelpProvider {}

export interface ILocalDocumentProvider
    extends IAutocompleteItemProvider,
        IDefinitionProvider,
        IHoverProvider,
        IFoldingRangeProvider,
        ISemanticTokenProvider,
        ISignatureHelpProvider {}
