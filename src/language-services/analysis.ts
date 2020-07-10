// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { CompletionItem, Hover, Position, Range, SignatureHelp } from "vscode-languageserver-types";

import { AnalysisOptions } from "./analysisOptions";
import * as AnalysisUtils from "./analysisUtils";
import { IDisposable } from "./commonTypes";
import { CurrentDocumentSymbolProvider } from "./currentDocumentSymbolProvider";
import * as InspectionUtils from "./inspectionUtils";
import { LanguageConstantProvider } from "./languageConstantProvider";
import * as LanguageServiceUtils from "./languageServiceUtils";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    LibrarySymbolProvider,
    NullLibrarySymbolProvider,
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
    protected readonly languageConstantProvider: LanguageConstantProvider;
    protected readonly librarySymbolProvider: LibrarySymbolProvider;
    protected readonly localSymbolProvider: SymbolProvider;

    protected readonly options: AnalysisOptions;
    protected readonly position: Position;
    protected readonly triedInspection: PQP.Task.TriedInspection | undefined;

    constructor(triedInspection: PQP.Task.TriedInspection | undefined, position: Position, options: AnalysisOptions) {
        this.triedInspection = triedInspection;
        this.options = options;
        this.position = position;

        this.environmentSymbolProvider = this.options.environmentSymbolProvider
            ? this.options.environmentSymbolProvider
            : new NullLibrarySymbolProvider();
        this.languageConstantProvider = new LanguageConstantProvider(this.triedInspection);
        this.librarySymbolProvider = this.options.librarySymbolProvider
            ? this.options.librarySymbolProvider
            : new NullLibrarySymbolProvider();
        this.localSymbolProvider = new CurrentDocumentSymbolProvider(this.triedInspection);
    }

    public async getCompletionItems(): Promise<CompletionItem[]> {
        let context: CompletionItemProviderContext = {};

        const maybeToken: PQP.Language.LineToken | undefined = this.maybeTokenAt();
        if (maybeToken !== undefined) {
            context = {
                range: AnalysisUtils.getTokenRangeForPosition(maybeToken, this.position),
                text: maybeToken.data,
                tokenKind: maybeToken.kind,
            };
        }

        // TODO: intellisense improvements
        // - honor expected data type
        // - get inspection for current scope
        // - only include current query name after @
        // - don't return completion items when on lefthand side of assignment

        // TODO: add tracing/logging to the catch()
        const getLibraryCompletionItems: Promise<CompletionItem[]> = this.librarySymbolProvider
            .getCompletionItems(context)
            .catch(() => {
                return LanguageServiceUtils.EmptyCompletionItems;
            });
        const getLanguageConstants: Promise<CompletionItem[]> = this.languageConstantProvider
            .getCompletionItems(context)
            .catch(() => {
                return LanguageServiceUtils.EmptyCompletionItems;
            });
        const getEnvironmentCompletionItems: Promise<
            CompletionItem[]
        > = this.environmentSymbolProvider.getCompletionItems(context).catch(() => {
            return LanguageServiceUtils.EmptyCompletionItems;
        });
        const getLocalCompletionItems: Promise<CompletionItem[]> = this.localSymbolProvider
            .getCompletionItems(context)
            .catch(() => {
                return LanguageServiceUtils.EmptyCompletionItems;
            });

        const [libraryResponse, keywordResponse, environmentResponse, localResponse] = await Promise.all([
            getLibraryCompletionItems,
            getLanguageConstants,
            getEnvironmentCompletionItems,
            getLocalCompletionItems,
        ]);

        let completionItems: CompletionItem[] = Array.isArray(keywordResponse) ? keywordResponse : [keywordResponse];
        completionItems = completionItems.concat(libraryResponse, environmentResponse, localResponse);

        return completionItems;
    }

    public async getHover(): Promise<Hover> {
        const identifierToken: PQP.Language.LineToken | undefined = this.maybeIdentifierAt();
        if (identifierToken) {
            const context: HoverProviderContext = {
                range: AnalysisUtils.getTokenRangeForPosition(identifierToken, this.position),
                identifier: identifierToken.data,
            };

            // TODO: add tracing/logging to the catch()
            const getLibraryHover: Promise<Hover | null> = this.librarySymbolProvider.getHover(context).catch(() => {
                // tslint:disable-next-line: no-null-keyword
                return null;
            });

            // TODO: use other providers
            // TODO: define priority when multiple providers return results
            const [libraryResponse] = await Promise.all([getLibraryHover]);
            if (libraryResponse) {
                return libraryResponse;
            }
        }

        return LanguageServiceUtils.EmptyHover;
    }

    public async getSignatureHelp(): Promise<SignatureHelp> {
        if (this.triedInspection === undefined || PQP.ResultUtils.isErr(this.triedInspection)) {
            return LanguageServiceUtils.EmptySignatureHelp;
        }
        const inspected: PQP.Task.InspectionOk = this.triedInspection.value;

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

        // TODO: add tracing/logging to the catch()
        const librarySignatureHelp: Promise<SignatureHelp | null> = this.librarySymbolProvider
            .getSignatureHelp(context)
            .catch(() => {
                // tslint:disable-next-line: no-null-keyword
                return null;
            });

        const [libraryResponse] = await Promise.all([librarySignatureHelp]);

        return libraryResponse ?? LanguageServiceUtils.EmptySignatureHelp;
    }

    public abstract dispose(): void;

    protected abstract getLexerState(): PQP.Lexer.State;
    protected abstract getText(range?: Range): string;

    private maybeIdentifierAt(): PQP.Language.LineToken | undefined {
        const maybeToken: PQP.Language.LineToken | undefined = this.maybeTokenAt();
        if (maybeToken) {
            const token: PQP.Language.LineToken = maybeToken;
            if (token.kind === PQP.Language.LineTokenKind.Identifier) {
                return token;
            }
        }

        return undefined;
    }

    private maybeLineTokensAt(): ReadonlyArray<PQP.Language.LineToken> | undefined {
        const lexResult: PQP.Lexer.State = this.getLexerState();
        const maybeLine: PQP.Lexer.TLine | undefined = lexResult.lines[this.position.line];
        return maybeLine?.tokens;
    }

    private maybeTokenAt(): PQP.Language.LineToken | undefined {
        const maybeLineTokens: ReadonlyArray<PQP.Language.LineToken> | undefined = this.maybeLineTokensAt();
        if (maybeLineTokens === undefined) {
            return undefined;
        }

        return AnalysisUtils.getTokenAtPosition(maybeLineTokens, this.position);
    }
}

class DocumentAnalysis extends AnalysisBase {
    constructor(private readonly document: TextDocument, position: Position, options: AnalysisOptions) {
        super(WorkspaceCache.maybeTriedInspection(document, position), position, options);
    }

    public dispose(): void {
        if (!this.options.maintainWorkspaceCache) {
            WorkspaceCache.close(this.document);
        }
    }

    protected getLexerState(): PQP.Lexer.State {
        return WorkspaceCache.getLexerState(this.document);
    }

    protected getText(range?: Range): string {
        return this.document.getText(range);
    }
}
