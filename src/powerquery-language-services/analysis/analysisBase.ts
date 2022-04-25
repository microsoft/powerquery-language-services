// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Hover, Range, SignatureHelp, TextEdit } from "vscode-languageserver-types";
import { Assert } from "@microsoft/powerquery-parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import * as InspectionUtils from "../inspectionUtils";
import { AutocompleteItem, AutocompleteItemUtils } from "../inspection";
import type {
    AutocompleteItemProvider,
    AutocompleteItemProviderContext,
    HoverProvider,
    HoverProviderContext,
    ISymbolProvider,
    SignatureHelpProvider,
    SignatureProviderContext,
} from "../providers/commonTypes";
import { CommonTypesUtils, Inspection } from "..";
import { EmptyHover, EmptySignatureHelp } from "../commonTypes";
import { findScopeItemByLiteral, findTheCreatorIdentifierOfOneScopeItem } from "../inspection/scope/scopeUtils";
import { LanguageAutocompleteItemProvider, LibrarySymbolProvider, LocalDocumentSymbolProvider } from "../providers";
import type { Analysis } from "./analysis";
import type { AnalysisSettings } from "./analysisSettings";
import { Library } from "../library";
import { PositionUtils } from "../..";

export abstract class AnalysisBase implements Analysis {
    protected languageAutocompleteItemProvider: AutocompleteItemProvider;
    protected librarySymbolProvider: ISymbolProvider;
    protected localDocumentSymbolProvider: ISymbolProvider;

    constructor(
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

        this.localDocumentSymbolProvider =
            analysisSettings.maybeCreateLocalDocumentSymbolProviderFn !== undefined
                ? analysisSettings.maybeCreateLocalDocumentSymbolProviderFn(
                      library,
                      promiseMaybeInspected,
                      analysisSettings.createInspectionSettingsFn,
                  )
                : new LocalDocumentSymbolProvider(
                      library,
                      promiseMaybeInspected,
                      analysisSettings.createInspectionSettingsFn,
                  );
    }

    public async getAutocompleteItems(): Promise<AutocompleteItem[]> {
        let context: AutocompleteItemProviderContext = {};

        const maybeToken: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
            await this.getMaybePositionIdentifier();

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
        const [languageResponse, libraryResponse, localDocumentResponse]: ReadonlyArray<
            ReadonlyArray<Inspection.AutocompleteItem>
        > = await Promise.all(
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
        const maybeActiveNode: Inspection.ActiveNode | undefined = await this.getMaybeActiveNode();

        const maybeIdentifierUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
            maybeActiveNode?.maybeExclusiveIdentifierUnderPosition;

        if (
            maybeActiveNode === undefined ||
            maybeIdentifierUnderPosition === undefined ||
            !AnalysisBase.isValidHoverIdentifier(maybeActiveNode)
        ) {
            return EmptyHover;
        }

        const identifier: Ast.Identifier | Ast.GeneralizedIdentifier = maybeIdentifierUnderPosition;

        const context: HoverProviderContext = {
            range: CommonTypesUtils.rangeFromTokenRange(identifier.tokenRange),
            identifier: identifier.literal,
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
        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            return EmptySignatureHelp;
        }

        const maybeContext: SignatureProviderContext | undefined =
            await InspectionUtils.getMaybeContextForSignatureProvider(maybeInspected);

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

    public async getRenameEdits(newName: string): Promise<TextEdit[]> {
        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;
        const activeNode: Inspection.ActiveNode | undefined = await this.getMaybeActiveNode();
        const scopeById: Inspection.ScopeById | undefined = maybeInspected?.typeCache.scopeById;

        const maybeIdentifierIncludedUnderPosition: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
            activeNode?.maybeInclusiveIdentifierUnderPosition;

        if (maybeInspected === undefined || maybeIdentifierIncludedUnderPosition === undefined) {
            return [];
        }

        const identifiersToBeEdited: (Ast.Identifier | Ast.GeneralizedIdentifier)[] = [];

        if (maybeIdentifierIncludedUnderPosition.kind === Ast.NodeKind.GeneralizedIdentifier) {
            // merely modify the GeneralizedIdentifier
            identifiersToBeEdited.push(maybeIdentifierIncludedUnderPosition);
        } else if (maybeIdentifierIncludedUnderPosition.kind === Ast.NodeKind.Identifier && scopeById) {
            // need to find this key value and modify all referring it
            const theIdentifierNode: Ast.Identifier = maybeIdentifierIncludedUnderPosition as Ast.Identifier;
            let valueCreator: Ast.Identifier | undefined = undefined;

            switch (theIdentifierNode.identifierContextKind) {
                case Ast.IdentifierContextKind.Key:
                case Ast.IdentifierContextKind.Parameter:
                    // it is the identifier creating the value
                    valueCreator = theIdentifierNode;
                    break;

                case Ast.IdentifierContextKind.Value: {
                    // it is the identifier referring the value
                    const nodeScope: Inspection.NodeScope | undefined = maybeInspected.typeCache.scopeById.get(
                        theIdentifierNode.id,
                    );

                    const scopeItem: Inspection.TScopeItem | undefined = findScopeItemByLiteral(
                        nodeScope,
                        maybeIdentifierIncludedUnderPosition.literal,
                    );

                    if (scopeItem) {
                        const maybeValueCreator: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
                            findTheCreatorIdentifierOfOneScopeItem(scopeItem);

                        if (maybeValueCreator?.kind === Ast.NodeKind.Identifier) {
                            if (
                                maybeValueCreator.identifierContextKind === Ast.IdentifierContextKind.Key ||
                                maybeValueCreator.identifierContextKind === Ast.IdentifierContextKind.Parameter
                            ) {
                                valueCreator = maybeValueCreator;
                            } else {
                                identifiersToBeEdited.push(maybeValueCreator);
                            }
                        } else if (maybeValueCreator) {
                            identifiersToBeEdited.push(maybeValueCreator);
                        }
                    }

                    break;
                }

                case Ast.IdentifierContextKind.Keyword:
                default:
                    // only modify once
                    identifiersToBeEdited.push(theIdentifierNode);
                    break;
            }

            if (valueCreator) {
                // need to populate the other identifiers referring it
                identifiersToBeEdited.push(...(await maybeInspected.collectAllIdentifiersBeneath(valueCreator)));
            }
        }

        return identifiersToBeEdited.map((one: Ast.Identifier | Ast.GeneralizedIdentifier) => ({
            range: PositionUtils.createRangeFromTokenRange(one.tokenRange),
            newText: newName,
        }));
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
        providers: ReadonlyArray<AutocompleteItemProvider>,
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<ReadonlyArray<AutocompleteItem>>> {
        // TODO: add tracing to the catch case
        return providers.map((provider: AutocompleteItemProvider) =>
            this.promiseWithTimeout(() => provider.getAutocompleteItems(context), [], timeoutInMS),
        );
    }

    private static createHoverCalls(
        context: HoverProviderContext,
        providers: HoverProvider[],
        timeoutInMS?: number,
    ): ReadonlyArray<Promise<Hover | null>> {
        // TODO: add tracing to the catch case
        return providers.map((provider: HoverProvider) =>
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

    private async getMaybePositionIdentifier(): Promise<Ast.Identifier | Ast.GeneralizedIdentifier | undefined> {
        const maybeActiveNode: Inspection.ActiveNode | undefined = await this.getMaybeActiveNode();

        return maybeActiveNode?.maybeExclusiveIdentifierUnderPosition;
    }

    private async getMaybeActiveNode(): Promise<Inspection.ActiveNode | undefined> {
        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            return undefined;
        }

        return Inspection.ActiveNodeUtils.isPositionInBounds(maybeInspected.maybeActiveNode)
            ? maybeInspected.maybeActiveNode
            : undefined;
    }
}
