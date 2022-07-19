// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { FoldingRange, Hover, Location, Range, SignatureHelp, TextEdit } from "vscode-languageserver-types";
import { Assert } from "@microsoft/powerquery-parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { DocumentUri } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import * as InspectionUtils from "../inspectionUtils";
import * as PositionUtils from "../positionUtils";
import { AutocompleteItem, AutocompleteItemUtils, TActiveLeafIdentifier } from "../inspection";
import type {
    AutocompleteItemProviderContext,
    IAutocompleteItemProvider,
    IHoverProvider,
    ILocalDocumentProvider,
    ISymbolProvider,
    OnIdentifierProviderContext,
    PartialSemanticToken,
    SignatureHelpProvider,
    SignatureProviderContext,
} from "../providers/commonTypes";
import { CommonTypesUtils, Inspection } from "..";
import { EmptyHover, EmptySignatureHelp } from "../commonTypes";
import { findScopeItemByLiteral, maybeScopeCreatorIdentifier } from "../inspection/scope/scopeUtils";
import { LanguageAutocompleteItemProvider, LibrarySymbolProvider, LocalDocumentProvider } from "../providers";
import type { Analysis } from "./analysis";
import type { AnalysisSettings } from "./analysisSettings";
import { Library } from "../library";
import { ValidationTraceConstant } from "../trace";

export abstract class AnalysisBase implements Analysis {
    protected languageAutocompleteItemProvider: IAutocompleteItemProvider;
    protected librarySymbolProvider: ISymbolProvider;
    protected localDocumentProvider: ILocalDocumentProvider;

    constructor(
        protected uri: DocumentUri,
        protected analysisSettings: AnalysisSettings,
        protected promiseMaybeInspected: Promise<Inspection.Inspected | undefined>,
    ) {
        const library: Library.ILibrary = analysisSettings.library;

        this.languageAutocompleteItemProvider =
            analysisSettings.maybeCreateLanguageAutocompleteItemProviderFn !== undefined
                ? analysisSettings.maybeCreateLanguageAutocompleteItemProviderFn()
                : new LanguageAutocompleteItemProvider(promiseMaybeInspected);

        this.librarySymbolProvider =
            analysisSettings.maybeCreateLibrarySymbolProviderFn !== undefined
                ? analysisSettings.maybeCreateLibrarySymbolProviderFn(library)
                : new LibrarySymbolProvider(library);

        this.localDocumentProvider =
            analysisSettings.maybeCreateLocalDocumentProviderFn !== undefined
                ? analysisSettings.maybeCreateLocalDocumentProviderFn(
                      library,
                      uri,
                      promiseMaybeInspected,
                      analysisSettings.createInspectionSettingsFn,
                  )
                : new LocalDocumentProvider(
                      library,
                      uri,
                      promiseMaybeInspected,
                      analysisSettings.createInspectionSettingsFn,
                  );
    }

    public async getAutocompleteItems(): Promise<AutocompleteItem[]> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getAutocompleteItems.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        let context: AutocompleteItemProviderContext = {
            traceManager: this.analysisSettings.traceManager,
            maybeInitialCorrelationId: trace.id,
        };

        const maybeActiveLeafIdentifier: TActiveLeafIdentifier | undefined = await this.getActiveLeafIdentifier();

        if (maybeActiveLeafIdentifier !== undefined) {
            context = {
                ...context,
                range: CommonTypesUtils.rangeFromTokenRange(maybeActiveLeafIdentifier.node.tokenRange),
                text: maybeActiveLeafIdentifier.normalizedLiteral,
                tokenKind: maybeActiveLeafIdentifier.node.kind,
            };
        }

        // TODO: intellisense improvements
        // - honor expected data type
        // - only include current query name after @
        const [languageResponse, libraryResponse, localDocumentResponse]: ReadonlyArray<
            ReadonlyArray<Inspection.AutocompleteItem>
        > = await Promise.all(
            AnalysisBase.createAutocompleteItemCalls(
                context,
                [this.languageAutocompleteItemProvider, this.librarySymbolProvider, this.localDocumentProvider],
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

        const result: AutocompleteItem[] = partial.sort(AutocompleteItemUtils.compareFn);
        trace.exit();

        return result;
    }

    public async getDefinition(): Promise<Location[]> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getDefinition.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const maybeIdentifierContext: OnIdentifierProviderContext | undefined =
            await this.getOnIdentifierProviderContext(trace.id);

        if (!maybeIdentifierContext) {
            trace.exit();

            return [];
        }

        const result: Location[] | null = await this.localDocumentProvider.getDefinition(maybeIdentifierContext);

        trace.exit();

        return result ?? [];
    }

    public async getFoldingRanges(): Promise<FoldingRange[]> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getFoldingRanges.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const result: FoldingRange[] = await this.localDocumentProvider.getFoldingRanges({
            traceManager: this.analysisSettings.traceManager,
            maybeInitialCorrelationId: trace.id,
        });

        trace.exit();

        return result;
    }

    public async getHover(): Promise<Hover> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getHover.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const maybeIdentifierContext: OnIdentifierProviderContext | undefined =
            await this.getOnIdentifierProviderContext(trace.id);

        if (!maybeIdentifierContext) {
            trace.exit();

            return EmptyHover;
        }

        // Result priority is based on the order of the symbol providers
        const result: Promise<Hover> = AnalysisBase.resolveProviders(
            AnalysisBase.createHoverCalls(
                maybeIdentifierContext,
                [this.localDocumentProvider, this.librarySymbolProvider],
                this.analysisSettings.symbolProviderTimeoutInMS,
            ),
            EmptyHover,
        );

        trace.exit();

        return result;
    }

    public async getPartialSemanticTokens(): Promise<PartialSemanticToken[]> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getPartialSemanticTokens.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const result: PartialSemanticToken[] = await this.localDocumentProvider.getPartialSemanticTokens({
            traceManager: this.analysisSettings.traceManager,
            maybeInitialCorrelationId: trace.id,
        });

        trace.exit();

        return result;
    }

    public async getSignatureHelp(): Promise<SignatureHelp> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getSignatureHelp.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            trace.exit();

            return EmptySignatureHelp;
        }

        const maybeContext: SignatureProviderContext | undefined =
            await InspectionUtils.getMaybeContextForSignatureProvider(
                maybeInspected,
                this.analysisSettings.traceManager,
                trace.id,
            );

        if (maybeContext === undefined) {
            trace.exit();

            return EmptySignatureHelp;
        }

        const context: SignatureProviderContext = maybeContext;

        if (context.functionName === undefined) {
            trace.exit();

            return EmptySignatureHelp;
        }

        // Result priority is based on the order of the symbol providers
        const result: Promise<SignatureHelp> = AnalysisBase.resolveProviders(
            AnalysisBase.createSignatureHelpCalls(
                context,
                [this.localDocumentProvider, this.librarySymbolProvider],
                this.analysisSettings.symbolProviderTimeoutInMS,
            ),
            EmptySignatureHelp,
        );

        trace.exit();

        return result;
    }

    public async getRenameEdits(newName: string): Promise<TextEdit[]> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getRenameEdits.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const maybeLeafIdentifier: TActiveLeafIdentifier | undefined = await this.getActiveLeafIdentifier();
        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;
        const scopeById: Inspection.ScopeById | undefined = maybeInspected?.typeCache.scopeById;

        if (maybeInspected === undefined || maybeLeafIdentifier === undefined) {
            trace.exit();

            return [];
        }

        const identifiersToBeEdited: (Ast.Identifier | Ast.GeneralizedIdentifier)[] = [];
        let valueCreator: Ast.Identifier | Ast.GeneralizedIdentifier | undefined = undefined;

        if (maybeLeafIdentifier.node.kind === Ast.NodeKind.GeneralizedIdentifier) {
            valueCreator = maybeLeafIdentifier.node;
        } else if (
            (maybeLeafIdentifier.node.kind === Ast.NodeKind.Identifier ||
                maybeLeafIdentifier.node.kind === Ast.NodeKind.IdentifierExpression) &&
            scopeById
        ) {
            // need to find this key value and modify all referring it
            const identifierExpression: Ast.Identifier =
                maybeLeafIdentifier.node.kind === Ast.NodeKind.IdentifierExpression
                    ? maybeLeafIdentifier.node.identifier
                    : maybeLeafIdentifier.node;

            switch (identifierExpression.identifierContextKind) {
                case Ast.IdentifierContextKind.Key:
                case Ast.IdentifierContextKind.Parameter:
                    // it is the identifier creating the value
                    valueCreator = identifierExpression;
                    break;

                case Ast.IdentifierContextKind.Value: {
                    // it is the identifier referring the value
                    let nodeScope: Inspection.NodeScope | undefined = maybeInspected.typeCache.scopeById.get(
                        identifierExpression.id,
                    );

                    // there might be a chance that its scope did not get populated yet, do another try
                    if (!nodeScope) {
                        await maybeInspected.tryNodeScope(identifierExpression.id);
                        nodeScope = maybeInspected.typeCache.scopeById.get(identifierExpression.id);
                    }

                    const scopeItem: Inspection.TScopeItem | undefined = findScopeItemByLiteral(
                        nodeScope,
                        maybeLeafIdentifier.normalizedLiteral,
                    );

                    if (scopeItem) {
                        const maybeValueCreator: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
                            maybeScopeCreatorIdentifier(scopeItem);

                        if (maybeValueCreator?.kind === Ast.NodeKind.Identifier) {
                            if (
                                maybeValueCreator.identifierContextKind === Ast.IdentifierContextKind.Key ||
                                maybeValueCreator.identifierContextKind === Ast.IdentifierContextKind.Parameter
                            ) {
                                valueCreator = maybeValueCreator;
                            } else {
                                identifiersToBeEdited.push(maybeValueCreator);
                            }
                        } else if (maybeValueCreator?.kind === Ast.NodeKind.GeneralizedIdentifier) {
                            valueCreator = maybeValueCreator;
                        } else if (maybeValueCreator) {
                            identifiersToBeEdited.push(maybeValueCreator);
                        }
                    }

                    break;
                }

                case Ast.IdentifierContextKind.Keyword:
                default:
                    // only modify once
                    identifiersToBeEdited.push(identifierExpression);
                    break;
            }
        }

        if (valueCreator) {
            // need to populate the other identifiers referring it
            identifiersToBeEdited.push(...(await maybeInspected.collectAllIdentifiersBeneath(valueCreator)));
        }

        // if none found, directly put maybeInclusiveIdentifierUnderPosition in if it exists
        if (identifiersToBeEdited.length === 0 && maybeLeafIdentifier) {
            identifiersToBeEdited.push(
                maybeLeafIdentifier.node.kind === Ast.NodeKind.IdentifierExpression
                    ? maybeLeafIdentifier.node.identifier
                    : maybeLeafIdentifier.node,
            );
        }

        const result: TextEdit[] = identifiersToBeEdited.map((one: Ast.Identifier | Ast.GeneralizedIdentifier) => ({
            range: PositionUtils.createRangeFromTokenRange(one.tokenRange),
            newText: newName,
        }));

        trace.exit();

        return result;
    }

    public abstract dispose(): void;

    protected abstract getText(range?: Range): string;

    private static promiseWithTimeout<T>(
        valueFn: () => Promise<T>,
        timeoutReturnValue: T,
        timeoutInMS?: number,
    ): Promise<T> {
        if (timeoutInMS !== undefined) {
            // TODO: Enabling trace entry when timeout occurs
            return Promise.race([
                valueFn(),
                new Promise<T>((resolve: (value: T | PromiseLike<T>) => void) =>
                    setTimeout(() => {
                        resolve(timeoutReturnValue);
                    }, timeoutInMS),
                ),
            ]);
        }

        return valueFn();
    }

    private static async resolveProviders<T>(
        calls: ReadonlyArray<Promise<T | null>>,
        defaultReturnValue: T,
    ): Promise<T> {
        const results: (T | null)[] = await Promise.all(calls);

        for (let i: number = 0; i < results.length; i += 1) {
            const result: T | null = results[i];

            if (result !== null) {
                return result;
            }
        }

        return defaultReturnValue;
    }

    private static createAutocompleteItemCalls(
        context: AutocompleteItemProviderContext,
        providers: ReadonlyArray<IAutocompleteItemProvider>,
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<ReadonlyArray<AutocompleteItem>>> {
        // TODO: add tracing to the catch case
        return providers.map((provider: IAutocompleteItemProvider) =>
            this.promiseWithTimeout(() => provider.getAutocompleteItems(context), [], timeoutInMS),
        );
    }

    private static createHoverCalls(
        context: OnIdentifierProviderContext,
        providers: IHoverProvider[],
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<Hover | null>> {
        // TODO: add tracing to the catch case
        return providers.map((provider: IHoverProvider) =>
            this.promiseWithTimeout(() => provider.getHover(context), null, timeoutInMS),
        );
    }

    private static createSignatureHelpCalls(
        context: SignatureProviderContext,
        providers: SignatureHelpProvider[],
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<SignatureHelp | null>> {
        // TODO: add tracing to the catch case
        return providers.map((provider: SignatureHelpProvider) =>
            this.promiseWithTimeout(() => provider.getSignatureHelp(context), null, timeoutInMS),
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

    private async getOnIdentifierProviderContext(
        correlationId: number,
    ): Promise<OnIdentifierProviderContext | undefined> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getDefinition.name,
            correlationId,
        );

        const maybeActiveNode: Inspection.ActiveNode | undefined = await this.getActiveNode();

        const maybeIdentifierUnderPosition: TActiveLeafIdentifier | undefined =
            maybeActiveNode?.maybeExclusiveIdentifierUnderPosition;

        if (
            maybeActiveNode === undefined ||
            maybeIdentifierUnderPosition === undefined ||
            !AnalysisBase.isValidHoverIdentifier(maybeActiveNode)
        ) {
            trace.exit();

            return undefined;
        }

        const identifier: Ast.Identifier | Ast.GeneralizedIdentifier =
            maybeIdentifierUnderPosition.node.kind === Ast.NodeKind.IdentifierExpression
                ? maybeIdentifierUnderPosition.node.identifier
                : maybeIdentifierUnderPosition.node;

        const context: OnIdentifierProviderContext = {
            traceManager: this.analysisSettings.traceManager,
            range: CommonTypesUtils.rangeFromTokenRange(identifier.tokenRange),
            identifier,
            maybeInitialCorrelationId: trace.id,
        };

        trace.exit();

        return context;
    }

    private async getActiveNode(): Promise<Inspection.ActiveNode | undefined> {
        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            return undefined;
        }

        return Inspection.ActiveNodeUtils.isPositionInBounds(maybeInspected.maybeActiveNode)
            ? maybeInspected.maybeActiveNode
            : undefined;
    }

    private async getActiveLeafIdentifier(): Promise<TActiveLeafIdentifier | undefined> {
        return (await this.getActiveNode())?.maybeInclusiveIdentifierUnderPosition;
    }
}
