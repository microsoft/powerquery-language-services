// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Hover, Position, Range, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";

import { CommonTypesUtils, Inspection } from "..";
import { EmptyHover, EmptySignatureHelp } from "../commonTypes";
import { AutocompleteItem, AutocompleteItemUtils } from "../inspection";
import { Library } from "../library";
import { LanguageAutocompleteItemProvider, LibrarySymbolProvider, LocalDocumentSymbolProvider } from "../providers";
import type {
    AutocompleteItemProvider,
    AutocompleteItemProviderContext,
    HoverProvider,
    HoverProviderContext,
    ISymbolProvider,
    SignatureHelpProvider,
    SignatureProviderContext,
} from "../providers/commonTypes";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import type { Analysis } from "./analysis";
import type { AnalysisSettings } from "./analysisSettings";

// tslint:disable: no-null-keyword

export abstract class AnalysisBase implements Analysis {
    protected languageAutocompleteItemProvider: AutocompleteItemProvider;
    protected librarySymbolProvider: ISymbolProvider;
    protected localDocumentSymbolProvider: ISymbolProvider;

    constructor(
        protected analysisSettings: AnalysisSettings,
        protected maybeInspectionCacheItem: WorkspaceCache.CacheItem,
        protected position: Position,
    ) {
        const library: Library.ILibrary = analysisSettings.library;

        this.languageAutocompleteItemProvider =
            analysisSettings.maybeCreateLanguageAutocompleteItemProviderFn !== undefined
                ? analysisSettings.maybeCreateLanguageAutocompleteItemProviderFn()
                : new LanguageAutocompleteItemProvider(maybeInspectionCacheItem);

        this.librarySymbolProvider =
            analysisSettings.maybeCreateLibrarySymbolProviderFn !== undefined
                ? analysisSettings.maybeCreateLibrarySymbolProviderFn(library)
                : new LibrarySymbolProvider(library);

        this.localDocumentSymbolProvider =
            analysisSettings.maybeCreateLocalDocumentSymbolProviderFn !== undefined
                ? analysisSettings.maybeCreateLocalDocumentSymbolProviderFn(
                      library,
                      maybeInspectionCacheItem,
                      analysisSettings.createInspectionSettingsFn,
                  )
                : new LocalDocumentSymbolProvider(
                      library,
                      maybeInspectionCacheItem,
                      analysisSettings.createInspectionSettingsFn,
                  );
    }

    public async getAutocompleteItems(): Promise<AutocompleteItem[]> {
        let context: AutocompleteItemProviderContext = {};

        const maybeToken: Ast.Identifier | Ast.GeneralizedIdentifier | undefined = this.getMaybePositionIdentifier();
        if (maybeToken !== undefined) {
            context = {
                range: CommonTypesUtils.rangeFromTokenRange(maybeToken.tokenRange),
                text: maybeToken.literal,
                tokenKind: maybeToken.kind,
            };
        }

        // TODO: intellisense improvements
        // - honor expected data type
        // - only include current query name after @
        const [languageResponse, libraryResponse, localDocumentResponse] = await Promise.all(
            AnalysisBase.createAutocompleteItemCalls(
                context,
                [this.languageAutocompleteItemProvider, this.librarySymbolProvider, this.localDocumentSymbolProvider],
                this.analysisSettings.symbolProviderTimeoutInMS,
            ),
        );

        const partial: AutocompleteItem[] = [];
        for (const collection of [localDocumentResponse, languageResponse, libraryResponse]) {
            for (const item of collection) {
                if (partial.find((partialItem: AutocompleteItem) => partialItem.label === item.label) === undefined) {
                    partial.push(item);
                }
            }
        }

        return partial.sort(AutocompleteItemUtils.compareFn);
    }

    public async getHover(): Promise<Hover> {
        const identifierToken: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
            this.getMaybePositionIdentifier();
        if (identifierToken === undefined) {
            return EmptyHover;
        }

        const maybeActiveNode: Inspection.ActiveNode | undefined = this.getMaybeActiveNode();
        if (maybeActiveNode === undefined || !AnalysisBase.isValidHoverIdentifier(maybeActiveNode)) {
            return EmptyHover;
        }

        const context: HoverProviderContext = {
            range: CommonTypesUtils.rangeFromTokenRange(identifierToken.tokenRange),
            identifier: identifierToken.literal,
        };

        // Result priority is based on the order of the symbol providers
        return AnalysisBase.resolveProviders(
            AnalysisBase.createHoverCalls(
                context,
                [this.localDocumentSymbolProvider, this.librarySymbolProvider],
                this.analysisSettings.symbolProviderTimeoutInMS,
            ),
            EmptyHover,
        );
    }

    public async getSignatureHelp(): Promise<SignatureHelp> {
        if (!WorkspaceCacheUtils.isInspectionTask(this.maybeInspectionCacheItem)) {
            return EmptySignatureHelp;
        }
        const inspected: Inspection.Inspection = this.maybeInspectionCacheItem;

        const maybeContext: SignatureProviderContext | undefined =
            InspectionUtils.getMaybeContextForSignatureProvider(inspected);
        if (maybeContext === undefined) {
            return EmptySignatureHelp;
        }
        const context: SignatureProviderContext = maybeContext;

        if (context.functionName === undefined) {
            return EmptySignatureHelp;
        }

        // Result priority is based on the order of the symbol providers
        return AnalysisBase.resolveProviders(
            AnalysisBase.createSignatureHelpCalls(
                context,
                [this.localDocumentSymbolProvider, this.librarySymbolProvider],
                this.analysisSettings.symbolProviderTimeoutInMS,
            ),
            EmptySignatureHelp,
        );
    }

    public abstract dispose(): void;

    protected abstract getLexerState(): WorkspaceCache.LexCacheItem;
    protected abstract getText(range?: Range): string;

    private static promiseWithTimeout<T>(promise: Promise<T>, timeoutReturnValue: T, timeoutInMS?: number): Promise<T> {
        if (timeoutInMS !== undefined) {
            // TODO: Enabling trace entry when timeout occurs
            return Promise.race([
                promise,
                new Promise<T>(resolve =>
                    setTimeout(() => {
                        resolve(timeoutReturnValue);
                    }, timeoutInMS),
                ),
            ]);
        }

        return promise;
    }

    private static async resolveProviders<T>(
        calls: ReadonlyArray<Promise<T | null>>,
        defaultReturnValue: T,
    ): Promise<T> {
        const results: (T | null)[] = await Promise.all(calls);

        for (let i: number = 0; i < results.length; i++) {
            if (results[i] !== null) {
                return results[i]!;
            }
        }

        return defaultReturnValue;
    }

    private static createAutocompleteItemCalls(
        context: AutocompleteItemProviderContext,
        providers: ReadonlyArray<AutocompleteItemProvider>,
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<ReadonlyArray<AutocompleteItem>>> {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            this.promiseWithTimeout(
                provider.getAutocompleteItems(context).catch(() => {
                    return [];
                }),
                [],
                timeoutInMS,
            ),
        );
    }

    private static createHoverCalls(
        context: HoverProviderContext,
        providers: HoverProvider[],
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<Hover | null>> {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            this.promiseWithTimeout(
                provider.getHover(context).catch(() => {
                    return null;
                }),
                null,
                timeoutInMS,
            ),
        );
    }

    private static createSignatureHelpCalls(
        context: SignatureProviderContext,
        providers: SignatureHelpProvider[],
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<SignatureHelp | null>> {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            this.promiseWithTimeout(
                provider.getSignatureHelp(context).catch(() => {
                    return null;
                }),
                null,
                timeoutInMS,
            ),
        );
    }

    private static isValidHoverIdentifier(activeNode: Inspection.ActiveNode): boolean {
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        if (ancestry.length <= 1) {
            return true;
        }

        const leaf: TXorNode = Assert.asDefined(ancestry[0]);
        const followingNode: TXorNode | undefined = ancestry[1];

        if (followingNode?.node?.kind === Ast.NodeKind.Parameter) {
            return false;
        }

        // Allow hover on either the key or value of [Generalized|Identifier]PairedExpression.
        // Validate it's not an incomplete Ast or that you're on the conjunction.
        else if (
            [
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                Ast.NodeKind.IdentifierPairedExpression,
            ].includes(followingNode.node.kind) &&
            [undefined, 1].includes(Assert.asDefined(leaf.node.maybeAttributeIndex))
        ) {
            return false;
        }

        return true;
    }

    private getMaybePositionIdentifier(): Ast.Identifier | Ast.GeneralizedIdentifier | undefined {
        return this.getMaybeActiveNode()?.maybeIdentifierUnderPosition;
    }

    private getMaybeActiveNode(): Inspection.ActiveNode | undefined {
        return WorkspaceCacheUtils.isInspectionTask(this.maybeInspectionCacheItem) &&
            Inspection.ActiveNodeUtils.isPositionInBounds(this.maybeInspectionCacheItem.maybeActiveNode)
            ? this.maybeInspectionCacheItem.maybeActiveNode
            : undefined;
    }
}
