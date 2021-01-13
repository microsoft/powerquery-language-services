// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { CompletionItem, Hover, Position, Range, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "./inspectionUtils";
import * as LanguageServiceUtils from "./languageServiceUtils";
import * as LineTokenAtPositionUtils from "./lineTokenAtPosition/lineTokenAtPositionUtils";

import { AnalysisOptions } from "./analysisOptions";
import { IDisposable } from "./commonTypes";
import { CurrentDocumentSymbolProvider } from "./currentDocumentSymbolProvider";
import { LanguageProvider } from "./languageProvider";
import { LineTokenAtPosition } from "./lineTokenAtPosition/lineTokenAtPosition";
import {
    CompletionItemProvider,
    CompletionItemProviderContext,
    HoverProvider,
    HoverProviderContext,
    LibrarySymbolProvider,
    NullLibrarySymbolProvider,
    SignatureHelpProvider,
    SignatureProviderContext,
    SymbolProvider,
} from "./providers";
import * as WorkspaceCache from "./workspaceCache";

export interface Analysis extends IDisposable {
    getCompletionItems(): Promise<CompletionItem[]>;
    getHover(): Promise<Hover>;
    getSignatureHelp(): Promise<SignatureHelp>;
}

export function createAnalysisSession(document: TextDocument, position: Position, options: AnalysisOptions): Analysis {
    return new DocumentAnalysis(document, position, options);
}

abstract class AnalysisBase implements Analysis {
    protected readonly environmentSymbolProvider: SymbolProvider;
    protected readonly languageProvider: LanguageProvider;
    protected readonly librarySymbolProvider: LibrarySymbolProvider;
    protected readonly localSymbolProvider: SymbolProvider;

    constructor(
        protected maybeInspectionCacheItem: WorkspaceCache.TInspectionCacheItem | undefined,
        protected position: Position,
        protected options: AnalysisOptions,
    ) {
        this.environmentSymbolProvider = this.options.environmentSymbolProvider
            ? this.options.environmentSymbolProvider
            : new NullLibrarySymbolProvider();
        this.languageProvider = new LanguageProvider(this.maybeInspectionCacheItem);
        this.librarySymbolProvider = this.options.librarySymbolProvider
            ? this.options.librarySymbolProvider
            : new NullLibrarySymbolProvider();
        this.localSymbolProvider = new CurrentDocumentSymbolProvider(this.maybeInspectionCacheItem);
    }

    public async getCompletionItems(): Promise<CompletionItem[]> {
        let context: CompletionItemProviderContext = {};

        const maybeToken: PQP.Language.Token.LineToken | undefined = this.maybeTokenAt();
        if (maybeToken !== undefined) {
            context = {
                range: LineTokenAtPositionUtils.getTokenRangeForPosition(maybeToken, this.position),
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
        const identifierToken: PQP.Language.Token.LineToken | undefined = this.maybeIdentifierAt();
        if (identifierToken === undefined) {
            return LanguageServiceUtils.EmptyHover;
        }
        const context: HoverProviderContext = {
            range: LineTokenAtPositionUtils.getTokenRangeForPosition(identifierToken, this.position),
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
    ): Promise<CompletionItem[]>[] {
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
    ): Promise<Hover | null>[] {
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
    ): Promise<SignatureHelp | null>[] {
        // TODO: add tracing to the catch case
        return providers.map(provider =>
            provider.getSignatureHelp(context).catch(() => {
                // tslint:disable-next-line: no-null-keyword
                return null;
            }),
        );
    }

    private static async resolveProviders<T>(calls: Promise<T | null>[], defaultReturnValue: T): Promise<T> {
        const results: (T | null)[] = await Promise.all(calls);

        for (let i: number = 0; i < results.length; i++) {
            if (results[i] !== null) {
                return results[i]!;
            }
        }

        return defaultReturnValue;
    }

    private maybeIdentifierAt(): PQP.Language.Token.LineToken | undefined {
        const maybeToken: PQP.Language.Token.LineToken | undefined = this.maybeTokenAt();
        if (maybeToken === undefined) {
            console.log(`maybeIdentifierAt - maybeToken falsy`);
            return undefined;
        }

        const token: PQP.Language.Token.LineToken = maybeToken;
        if (token.kind === PQP.Language.Token.LineTokenKind.Identifier) {
            console.log(`maybeIdentifierAt - token.kind IS Identifier`);
            return token;
        }

        console.log(`maybeIdentifierAt - token.kind ISN'T identifier ${token.kind}`);
        return undefined;
    }

    private maybeLineTokensAt(): ReadonlyArray<PQP.Language.Token.LineToken> | undefined {
        const cacheItem: WorkspaceCache.LexerCacheItem = this.getLexerState();
        if (cacheItem.kind !== PQP.ResultKind.Ok || cacheItem.stage !== WorkspaceCache.CacheStageKind.Lexer) {
            return undefined;
        }

        const maybeLine: PQP.Lexer.TLine | undefined = cacheItem.value.lines[this.position.line];
        return maybeLine?.tokens;
    }

    private maybeTokenAt(): LineTokenAtPosition | undefined {
        const maybeLineTokens: ReadonlyArray<PQP.Language.Token.LineToken> | undefined = this.maybeLineTokensAt();
        if (maybeLineTokens === undefined) {
            return undefined;
        }

        return LineTokenAtPositionUtils.getTokenAtPosition(maybeLineTokens, this.position);
    }
}

class DocumentAnalysis extends AnalysisBase {
    constructor(private readonly document: TextDocument, position: Position, options: AnalysisOptions) {
        super(WorkspaceCache.getTriedInspection(document, position, options.locale), position, options);
    }

    public dispose(): void {
        if (!this.options.maintainWorkspaceCache) {
            WorkspaceCache.close(this.document);
        }
    }

    protected getLexerState(): WorkspaceCache.LexerCacheItem {
        return WorkspaceCache.getLexerState(this.document, this.options.locale);
    }

    protected getText(range?: Range): string {
        return this.document.getText(range);
    }
}
