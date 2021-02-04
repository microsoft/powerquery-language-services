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
    LibraryProvider,
    SignatureHelpProvider,
    SignatureProviderContext,
    SymbolProvider,
} from "../providers/commonTypes";
import { CurrentDocumentSymbolProvider } from "../providers/currentDocumentSymbolProvider";
import { LanguageProvider } from "../providers/languageProvider";
import { NullLibraryProvider } from "../providers/nullProvider";
import { Analysis } from "./analysis";
import { AnalysisOptions } from "./analysisOptions";
import { LineTokenWithPosition, LineTokenWithPositionUtils } from "./lineTokenWithPosition";

export abstract class AnalysisBase implements Analysis {
    protected readonly environmentSymbolProvider: SymbolProvider;
    protected readonly languageProvider: LanguageProvider;
    protected readonly libraryProvider: LibraryProvider;
    protected readonly localSymbolProvider: SymbolProvider;

    constructor(
        protected maybeInspectionCacheItem: WorkspaceCache.TInspectionCacheItem | undefined,
        protected position: Position,
        protected options: AnalysisOptions,
    ) {
        this.environmentSymbolProvider = options.environmentSymbolProvider ?? NullLibraryProvider.singleton();
        this.languageProvider = new LanguageProvider(this.maybeInspectionCacheItem);
        this.libraryProvider = options.libraryProvider ?? NullLibraryProvider.singleton();
        this.localSymbolProvider = new CurrentDocumentSymbolProvider(this.maybeInspectionCacheItem);
    }

    public async getCompletionItems(): Promise<CompletionItem[]> {
        let context: CompletionItemProviderContext = {};

        const maybeToken: LineTokenWithPosition | undefined = this.getMaybeLineTokenWithPosition();
        if (maybeToken !== undefined) {
            context = {
                range: LineTokenWithPositionUtils.tokenRange(maybeToken),
                text: maybeToken.data,
                tokenKind: maybeToken.kind,
            };
        }

        // TODO: intellisense improvements
        // - honor expected data type
        // - only include current query name after @

        const [libraryResponse, parserResponse, environmentResponse, localResponse] = await Promise.all(
            AnalysisBase.createCompletionItemCalls(context, [
                this.libraryProvider,
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
        const identifierToken: LineTokenWithPosition | undefined = this.getMaybePositionIdentifier();
        if (identifierToken === undefined) {
            return LanguageServiceUtils.EmptyHover;
        }

        const maybeActiveNode: PQP.Inspection.ActiveNode | undefined = this.getMaybeActiveNode();
        if (maybeActiveNode === undefined || !AnalysisBase.isValidHoverIdentifier(maybeActiveNode)) {
            return LanguageServiceUtils.EmptyHover;
        }

        const context: HoverProviderContext = {
            range: LineTokenWithPositionUtils.tokenRange(identifierToken),
            identifier: identifierToken.data,
        };

        // Result priority is based on the order of the symbol providers
        return AnalysisBase.resolveProviders(
            AnalysisBase.createHoverCalls(context, [
                this.localSymbolProvider,
                this.environmentSymbolProvider,
                this.libraryProvider,
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
                this.libraryProvider,
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

    private static isValidHoverIdentifier(activeNode: PQP.Inspection.ActiveNode): boolean {
        const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
        if (ancestry.length <= 1) {
            return true;
        }

        const leaf: PQP.Parser.TXorNode = PQP.Assert.asDefined(ancestry[0]);
        if (leaf.node.kind === PQP.Language.Ast.NodeKind.GeneralizedIdentifier) {
            return false;
        }

        const followingNode: PQP.Parser.TXorNode = PQP.Assert.asDefined(ancestry[1]);
        if (followingNode.node.kind === PQP.Language.Ast.NodeKind.Parameter) {
            return false;
        } else if (
            followingNode.node.kind === PQP.Language.Ast.NodeKind.IdentifierPairedExpression &&
            leaf.node.maybeAttributeIndex !== 2
        ) {
            return false;
        }

        return true;
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

    private getMaybePositionIdentifier(): LineTokenWithPosition | undefined {
        const maybeToken: LineTokenWithPosition | undefined = this.getMaybeLineTokenWithPosition();
        if (maybeToken === undefined) {
            return undefined;
        }

        const token: LineTokenWithPosition = maybeToken;
        if (token.kind === PQP.Language.Token.LineTokenKind.Identifier) {
            return token;
        }

        return undefined;
    }

    private getMaybeLineTokens(): ReadonlyArray<PQP.Language.Token.LineToken> | undefined {
        const cacheItem: WorkspaceCache.LexerCacheItem = this.getLexerState();
        if (cacheItem.kind !== PQP.ResultKind.Ok || cacheItem.stage !== WorkspaceCache.CacheStageKind.Lexer) {
            return undefined;
        }

        const maybeLine: PQP.Lexer.TLine | undefined = cacheItem.value.lines[this.position.line];
        return maybeLine?.tokens;
    }

    private getMaybeLineTokenWithPosition(): LineTokenWithPosition | undefined {
        const maybeLineTokens: ReadonlyArray<PQP.Language.Token.LineToken> | undefined = this.getMaybeLineTokens();
        if (maybeLineTokens === undefined) {
            return undefined;
        }

        return LineTokenWithPositionUtils.maybeFrom(this.position, maybeLineTokens);
    }

    private getMaybeActiveNode(): PQP.Inspection.ActiveNode | undefined {
        return this.maybeInspectionCacheItem?.stage === WorkspaceCache.CacheStageKind.Inspection &&
            PQP.ResultUtils.isOk(this.maybeInspectionCacheItem) &&
            PQP.Inspection.ActiveNodeUtils.isPositionInBounds(this.maybeInspectionCacheItem.value.maybeActiveNode)
            ? this.maybeInspectionCacheItem.value.maybeActiveNode
            : undefined;
    }
}
