// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { CompletionItem, Hover, Position, Range, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";
import * as LanguageServiceUtils from "../languageServiceUtils";
import * as WorkspaceCache from "../workspaceCache";

import {
    CompletionItemProvider,
    CompletionItemProviderContext,
    HoverProvider,
    HoverProviderContext,
    LibrarySymbolProvider,
    SignatureHelpProvider,
    SignatureProviderContext,
    SymbolProvider,
} from "../providers/commonTypes";
import { CurrentDocumentSymbolProvider } from "../providers/currentDocumentSymbolProvider";
import { LanguageProvider } from "../providers/languageProvider";
import { NullLibrarySymbolProvider } from "../providers/nullProvider";
import { Analysis } from "./analysis";
import { AnalysisOptions } from "./analysisOptions";
import { PositionLineToken, PositionLineTokenUtils } from "./positionLineToken";

export abstract class AnalysisBase implements Analysis {
    protected readonly environmentSymbolProvider: SymbolProvider;
    protected readonly languageProvider: LanguageProvider;
    protected readonly librarySymbolProvider: LibrarySymbolProvider;
    protected readonly localSymbolProvider: SymbolProvider;

    constructor(
        protected maybeInspectionCacheItem: WorkspaceCache.TInspectionCacheItem | undefined,
        protected position: Position,
        protected options: AnalysisOptions,
    ) {
        this.environmentSymbolProvider = options.environmentSymbolProvider ?? NullLibrarySymbolProvider.singleton();
        this.languageProvider = new LanguageProvider(this.maybeInspectionCacheItem);
        this.librarySymbolProvider = options.librarySymbolProvider ?? NullLibrarySymbolProvider.singleton();
        this.localSymbolProvider = new CurrentDocumentSymbolProvider(this.maybeInspectionCacheItem);
    }

    public async getCompletionItems(): Promise<CompletionItem[]> {
        let context: CompletionItemProviderContext = {};

        const maybeToken: PQP.Language.Token.LineToken | undefined = this.maybeGetPositionLineToken();
        if (maybeToken !== undefined) {
            context = {
                range: PositionLineTokenUtils.positionTokenLineRange(this.position, maybeToken),
                text: maybeToken.data,
                tokenKind: maybeToken.kind,
            };
        }

        // TODO: intellisense improvements
        // - honor expected data type
        // - get inspection for current scope
        // - only include current query name after @
        // - don't return completion items when on lefthand side of assignment

        const [libraryResponse, parserResponse, environmentResponse, localResponse] = await Promise.all(
            AnalysisBase.createCompletionItemCalls(context, [
                this.librarySymbolProvider,
                this.languageProvider,
                this.environmentSymbolProvider,
                this.localSymbolProvider,
            ]),
        );

        // TODO: Should we filter out duplicates?
        const completionItems: CompletionItem[] = localResponse.concat(
            environmentResponse,
            libraryResponse,
            parserResponse,
        );

        return completionItems;
    }

    public async getHover(): Promise<Hover> {
        const identifierToken: PQP.Language.Token.LineToken | undefined = this.maybeGetPositionIdentifier();
        if (identifierToken === undefined) {
            return LanguageServiceUtils.EmptyHover;
        }
        const context: HoverProviderContext = {
            range: PositionLineTokenUtils.positionTokenLineRange(this.position, identifierToken),
            identifier: identifierToken.data,
        };

        // Result priority is based on the order of the symbol providers
        return AnalysisBase.resolveProviders(
            AnalysisBase.createHoverCalls(context, [
                this.localSymbolProvider,
                this.environmentSymbolProvider,
                this.librarySymbolProvider,
            ]),
            LanguageServiceUtils.EmptyHover,
        );
    }

    public async getSignatureHelp(): Promise<SignatureHelp> {
        if (
            this.maybeInspectionCacheItem === undefined ||
            this.maybeInspectionCacheItem.kind !== PQP.ResultKind.Ok ||
            this.maybeInspectionCacheItem.stage !== WorkspaceCache.CacheStageKind.Inspection
        ) {
            return LanguageServiceUtils.EmptySignatureHelp;
        }
        const inspected: PQP.Inspection.Inspection = this.maybeInspectionCacheItem.value;

        const maybeContext: SignatureProviderContext | undefined = InspectionUtils.maybeSignatureProviderContext(
            inspected,
        );
        if (maybeContext === undefined) {
            return LanguageServiceUtils.EmptySignatureHelp;
        }
        const context: SignatureProviderContext = maybeContext;

        if (context.functionName === undefined) {
            return LanguageServiceUtils.EmptySignatureHelp;
        }

        // Result priority is based on the order of the symbol providers
        return AnalysisBase.resolveProviders(
            AnalysisBase.createSignatureHelpCalls(context, [
                this.localSymbolProvider,
                this.environmentSymbolProvider,
                this.librarySymbolProvider,
            ]),
            LanguageServiceUtils.EmptySignatureHelp,
        );
    }

    public abstract dispose(): void;

    protected abstract getLexerState(): WorkspaceCache.LexerCacheItem;
    protected abstract getText(range?: Range): string;

    private static createCompletionItemCalls(
        context: CompletionItemProviderContext,
        providers: CompletionItemProvider[],
    ): ReadonlyArray<Promise<ReadonlyArray<CompletionItem>>> {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            provider.getCompletionItems(context).catch(() => {
                return LanguageServiceUtils.EmptyCompletionItems;
            }),
        );
    }

    private static createHoverCalls(
        context: HoverProviderContext,
        providers: HoverProvider[],
    ): ReadonlyArray<Promise<Hover | null>> {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            provider.getHover(context).catch(() => {
                // tslint:disable-next-line: no-null-keyword
                return null;
            }),
        );
    }

    private static createSignatureHelpCalls(
        context: SignatureProviderContext,
        providers: SignatureHelpProvider[],
    ): ReadonlyArray<Promise<SignatureHelp | null>> {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            provider.getSignatureHelp(context).catch(() => {
                // tslint:disable-next-line: no-null-keyword
                return null;
            }),
        );
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

    private maybeGetPositionIdentifier(): PQP.Language.Token.LineToken | undefined {
        const maybeToken: PQP.Language.Token.LineToken | undefined = this.maybeGetPositionLineToken();
        if (maybeToken === undefined) {
            return undefined;
        }

        const token: PQP.Language.Token.LineToken = maybeToken;
        if (token.kind === PQP.Language.Token.LineTokenKind.Identifier) {
            return token;
        }

        return undefined;
    }

    private maybeGetLineTokens(): ReadonlyArray<PQP.Language.Token.LineToken> | undefined {
        const cacheItem: WorkspaceCache.LexerCacheItem = this.getLexerState();
        if (cacheItem.kind !== PQP.ResultKind.Ok || cacheItem.stage !== WorkspaceCache.CacheStageKind.Lexer) {
            return undefined;
        }

        const maybeLine: PQP.Lexer.TLine | undefined = cacheItem.value.lines[this.position.line];
        return maybeLine?.tokens;
    }

    private maybeGetPositionLineToken(): PositionLineToken | undefined {
        const maybeLineTokens: ReadonlyArray<PQP.Language.Token.LineToken> | undefined = this.maybeGetLineTokens();
        if (maybeLineTokens === undefined) {
            return undefined;
        }

        return PositionLineTokenUtils.maybePositionLineToken(this.position, maybeLineTokens);
    }
}
