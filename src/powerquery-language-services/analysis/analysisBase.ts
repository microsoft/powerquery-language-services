// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser/lib/powerquery-parser";
import { Assert, CommonError, ICancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";
import {
    AstNodeById,
    ChildIdsById,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser/nodeIdMap/nodeIdMap";
import type { FoldingRange, Hover, Location, Position, SignatureHelp } from "vscode-languageserver-types";
import { NodeIdMap, ParseError, ParseState, TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ActiveNodeUtils, TActiveLeafIdentifier, TMaybeActiveNode, TypeCache } from "../inspection";
import type {
    AutocompleteItemProviderContext,
    DefinitionProviderContext,
    HoverProviderContext,
    IAutocompleteItemProvider,
    IDefinitionProvider,
    IFoldingRangeProvider,
    IHoverProvider,
    ISemanticTokenProvider,
    ISignatureHelpProvider,
    PartialSemanticToken,
    SignatureProviderContext,
} from "../providers/commonTypes";
import { CommonTypesUtils, Inspection, InspectionSettings, PositionUtils } from "..";
import {
    findDirectUpperScopeExpression,
    findScopeItemByLiteral,
    maybeScopeCreatorIdentifier,
    TScopeItem,
} from "../inspection/scope/scopeUtils";
import { LanguageAutocompleteItemProvider, LibrarySymbolProvider, LocalDocumentProvider } from "../providers";
import type { Analysis } from "./analysis";
import type { AnalysisSettings } from "./analysisSettings";
import { ValidationTraceConstant } from "../trace";

export abstract class AnalysisBase implements Analysis {
    protected languageAutocompleteItemProvider: IAutocompleteItemProvider;
    protected librarySymbolProvider: IAutocompleteItemProvider & IHoverProvider & ISignatureHelpProvider;
    protected localDocumentProvider: IAutocompleteItemProvider &
        IDefinitionProvider &
        IHoverProvider &
        IFoldingRangeProvider &
        ISemanticTokenProvider &
        ISignatureHelpProvider;

    protected cancellableTokensByAction: Map<string, PQP.ICancellationToken> = new Map();

    // Shared across actions
    protected parseError: ParseError.ParseError | undefined = undefined;
    protected parseState: ParseState | undefined = undefined;
    protected triedLexParse: PQP.Task.TriedLexParseTask | undefined = undefined;
    protected typeCache: TypeCache = {
        scopeById: new Map(),
        typeById: new Map(),
    };

    constructor(protected textDocument: TextDocument, protected analysisSettings: AnalysisSettings) {
        this.languageAutocompleteItemProvider = new LanguageAutocompleteItemProvider();

        this.librarySymbolProvider = new LibrarySymbolProvider(analysisSettings.inspectionSettings.library);

        this.localDocumentProvider = new LocalDocumentProvider(
            this.textDocument.uri.toString(),
            this.typeCache,
            analysisSettings.inspectionSettings.library,
        );

        void this.initializeState();
    }

    public async getAutocompleteItems(
        position: Position,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getAutocompleteItems.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getAutocompleteItems.name);

        const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
            this.getAutocompleteItems.name,
        );

        const maybeActiveNode: TMaybeActiveNode | undefined = await this.getActiveNode(position);

        if (maybeActiveNode === undefined) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        }

        const autocomplete: Inspection.Autocomplete = Assert.asDefined(
            await this.inspectAutocomplete(maybeActiveNode, newCancellationToken, trace.id),
        );

        const triedNodeScope: Inspection.TriedNodeScope = Assert.asDefined(
            await this.inspectNodeScope(maybeActiveNode, newCancellationToken, trace.id),
        );

        const triedScopeType: Inspection.TriedScopeType = Assert.asDefined(
            await this.inspectScopeType(maybeActiveNode, newCancellationToken, trace.id),
        );

        const maybeActiveLeafIdentifier: TActiveLeafIdentifier | undefined = ActiveNodeUtils.isPositionInBounds(
            maybeActiveNode,
        )
            ? maybeActiveNode.maybeInclusiveIdentifierUnderPosition
            : undefined;

        let context: AutocompleteItemProviderContext;

        if (maybeActiveLeafIdentifier !== undefined) {
            context = {
                autocomplete,
                triedNodeScope,
                triedScopeType,
                traceManager: this.analysisSettings.traceManager,
                maybeCancellationToken: newCancellationToken,
                maybeInitialCorrelationId: trace.id,
                range: CommonTypesUtils.rangeFromTokenRange(maybeActiveLeafIdentifier.node.tokenRange),
                text: maybeActiveLeafIdentifier.normalizedLiteral,
                tokenKind: maybeActiveLeafIdentifier.node.kind,
            };
        } else {
            context = {
                autocomplete,
                triedNodeScope,
                triedScopeType,
                traceManager: this.analysisSettings.traceManager,
                maybeCancellationToken: newCancellationToken,
                maybeInitialCorrelationId: trace.id,
            };
        }

        const autocompleteItemTasks: Promise<
            PQP.Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>
        >[] = [
            this.languageAutocompleteItemProvider.getAutocompleteItems(context),
            this.librarySymbolProvider.getAutocompleteItems(context),
            this.localDocumentProvider.getAutocompleteItems(context),
        ];

        const autocompleteItems: Inspection.AutocompleteItem[] = [];

        // TODO: intellisense improvements
        // - honor expected data type

        for (const result of await Promise.all(autocompleteItemTasks)) {
            if (PQP.ResultUtils.isOk(result) && result.value !== undefined) {
                for (const item of result.value) {
                    autocompleteItems.push(item);
                }
            }
        }

        trace.exit();

        return PQP.ResultUtils.boxOk(autocompleteItems);
    }

    public async getDefinition(position: Position): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getDefinition.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getDefinition.name);

        const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
            this.getDefinition.name,
        );

        const maybeIdentifierContext: DefinitionProviderContext | undefined = await this.getDefinitionProviderContext(
            position,
            trace.id,
            newCancellationToken,
        );

        if (!maybeIdentifierContext) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        }

        const result: Result<Location[] | undefined, CommonError.CommonError> =
            await this.localDocumentProvider.getDefinition(maybeIdentifierContext);

        trace.exit();

        return result ?? [];
    }

    public async getFoldingRanges(): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getFoldingRanges.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getFoldingRanges.name);

        const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
            this.getFoldingRanges.name,
        );

        const maybeParseState: ParseState | undefined = await this.getParseState();

        if (maybeParseState === undefined) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        }

        const result: Result<FoldingRange[] | undefined, CommonError.CommonError> =
            await this.localDocumentProvider.getFoldingRanges({
                traceManager: this.analysisSettings.traceManager,
                maybeInitialCorrelationId: trace.id,
                maybeCancellationToken: newCancellationToken,
                nodeIdMapCollection: maybeParseState.contextState.nodeIdMapCollection,
            });

        trace.exit();

        return result;
    }

    public async getHover(position: Position): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getHover.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getHover.name);

        const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
            this.getHover.name,
        );

        const maybeHoverProviderContext: HoverProviderContext | undefined = await this.getHoverProviderContext(
            position,
            trace.id,
            newCancellationToken,
        );

        if (!maybeHoverProviderContext) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        }

        const triedHovers: Result<Hover | undefined, CommonError.CommonError>[] = await Promise.all([
            this.localDocumentProvider.getHover(maybeHoverProviderContext),
            this.librarySymbolProvider.getHover(maybeHoverProviderContext),
        ]);

        for (const triedHover of triedHovers) {
            if (ResultUtils.isOk(triedHover) && triedHover.value) {
                trace.exit();

                return triedHover;
            }
        }

        trace.exit();

        return ResultUtils.boxOk(undefined);
    }

    public async getPartialSemanticTokens(): Promise<
        Result<PartialSemanticToken[] | undefined, CommonError.CommonError>
    > {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getPartialSemanticTokens.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getPartialSemanticTokens.name);

        const result: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
            await this.localDocumentProvider.getPartialSemanticTokens({
                traceManager: this.analysisSettings.traceManager,
                maybeInitialCorrelationId: trace.id,
                maybeCancellationToken: this.analysisSettings.createCancellationTokenFn(
                    this.getPartialSemanticTokens.name,
                ),
                library: this.analysisSettings.inspectionSettings.library,
                parseState: Assert.asDefined(await this.getParseState()),
            });

        trace.exit();

        return result;
    }

    public async getSignatureHelp(
        position: Position,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getSignatureHelp.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getSignatureHelp.name);

        const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
            this.getSignatureHelp.name,
        );

        const triedCurrentInvokeExpression: Inspection.TriedCurrentInvokeExpression | undefined =
            await this.inspectCurrentInvokeExpression(position, trace.id, newCancellationToken);

        if (
            triedCurrentInvokeExpression === undefined ||
            ResultUtils.isError(triedCurrentInvokeExpression) ||
            triedCurrentInvokeExpression.value === undefined
        ) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        }

        const invokeExpression: Inspection.CurrentInvokeExpression = triedCurrentInvokeExpression.value;

        const functionName: string | undefined =
            invokeExpression.maybeName !== undefined ? invokeExpression.maybeName : undefined;

        const argumentOrdinal: number | undefined =
            invokeExpression.maybeArguments !== undefined ? invokeExpression.maybeArguments.argumentOrdinal : undefined;

        if (functionName === undefined || argumentOrdinal === undefined) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        }

        const context: SignatureProviderContext = {
            argumentOrdinal,
            functionName,
            isNameInLocalScope: invokeExpression.isNameInLocalScope,
            functionType: invokeExpression.functionType,
            traceManager: this.analysisSettings.traceManager,
            maybeCancellationToken: newCancellationToken,
            maybeInitialCorrelationId: trace.id,
            triedCurrentInvokeExpression: await Inspection.tryCurrentInvokeExpression(
                {
                    ...this.analysisSettings.inspectionSettings,
                    maybeCancellationToken: newCancellationToken,
                    maybeInitialCorrelationId: trace.id,
                },
                Assert.asDefined(await this.getParseState()).contextState.nodeIdMapCollection,
                Assert.asDefined(await this.getActiveNode(position)),
                this.typeCache,
            ),
        };

        const signatureTasks: Result<SignatureHelp | undefined, CommonError.CommonError>[] = await Promise.all([
            this.localDocumentProvider.getSignatureHelp(context),
            this.librarySymbolProvider.getSignatureHelp(context),
        ]);

        for (const task of signatureTasks) {
            if (task && ResultUtils.isOk(task)) {
                return task;
            }
        }

        return ResultUtils.boxOk(undefined);
    }

    public async getRenameEdits(
        position: Position,
        newName: string,
    ): Promise<Result<TextEdit[] | undefined, CommonError.CommonError>> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getRenameEdits.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        this.cancelPreviousTokenIfExists(this.getRenameEdits.name);

        const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
            this.getRenameEdits.name,
        );

        const maybeActiveNode: TMaybeActiveNode = Assert.asDefined(await this.getActiveNode(position));

        let maybeLeafIdentifier: TActiveLeafIdentifier | undefined;

        if (
            !ActiveNodeUtils.isPositionInBounds(maybeActiveNode) ||
            maybeActiveNode.maybeInclusiveIdentifierUnderPosition === undefined
        ) {
            trace.exit();

            return ResultUtils.boxOk(undefined);
        } else {
            maybeLeafIdentifier = maybeActiveNode.maybeInclusiveIdentifierUnderPosition;
        }

        void (await this.inspectNodeScope(maybeActiveNode, newCancellationToken, trace.id));
        const scopeById: Inspection.ScopeById | undefined = this.typeCache.scopeById;

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
                    let nodeScope: Inspection.NodeScope | undefined = scopeById.get(identifierExpression.id);

                    // there might be a chance that its scope did not get populated yet, do another try
                    if (!nodeScope) {
                        void (await Inspection.tryNodeScope(
                            this.analysisSettings.inspectionSettings,
                            Assert.asDefined(await this.getParseState()).contextState.nodeIdMapCollection,
                            identifierExpression.id,
                            scopeById,
                        ));

                        nodeScope = scopeById.get(identifierExpression.id);
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
            identifiersToBeEdited.push(
                ...(await this.collectAllIdentifiersBeneath(
                    Assert.asDefined(await this.getParseState()).contextState.nodeIdMapCollection,
                    valueCreator,
                )),
            );
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

        return ResultUtils.boxOk(result);
    }

    public abstract dispose(): void;

    // protected abstract getText(range?: Range): string;

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

    private async getDefinitionProviderContext(
        position: Position,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<DefinitionProviderContext | undefined> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getDefinitionProviderContext.name,
            correlationId,
        );

        const maybeActiveNode: Inspection.TMaybeActiveNode | undefined = await this.getActiveNode(position);

        if (maybeActiveNode === undefined || !ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
            trace.exit();

            return Promise.resolve(undefined);
        }

        const maybeIdentifierUnderPosition: TActiveLeafIdentifier | undefined =
            maybeActiveNode.maybeExclusiveIdentifierUnderPosition;

        if (maybeIdentifierUnderPosition === undefined || !AnalysisBase.isValidHoverIdentifier(maybeActiveNode)) {
            trace.exit();

            return undefined;
        }

        const identifier: Ast.Identifier | Ast.GeneralizedIdentifier =
            maybeIdentifierUnderPosition.node.kind === Ast.NodeKind.IdentifierExpression
                ? maybeIdentifierUnderPosition.node.identifier
                : maybeIdentifierUnderPosition.node;

        const context: DefinitionProviderContext = {
            traceManager: this.analysisSettings.traceManager,
            range: CommonTypesUtils.rangeFromTokenRange(identifier.tokenRange),
            identifier,
            maybeCancellationToken: cancellationToken,
            maybeInitialCorrelationId: trace.id,
            triedNodeScope: Assert.asDefined(await this.inspectNodeScope(maybeActiveNode, cancellationToken, trace.id)),
        };

        trace.exit();

        return context;
    }

    private async getHoverProviderContext(
        position: Position,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<HoverProviderContext | undefined> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getHoverProviderContext.name,
            correlationId,
        );

        const maybeActiveNode: Inspection.TMaybeActiveNode | undefined = await this.getActiveNode(position);

        if (maybeActiveNode === undefined || !ActiveNodeUtils.isPositionInBounds(maybeActiveNode)) {
            trace.exit();

            return Promise.resolve(undefined);
        }

        const maybeIdentifierUnderPosition: TActiveLeafIdentifier | undefined =
            maybeActiveNode.maybeExclusiveIdentifierUnderPosition;

        if (maybeIdentifierUnderPosition === undefined || !AnalysisBase.isValidHoverIdentifier(maybeActiveNode)) {
            trace.exit();

            return undefined;
        }

        const identifier: Ast.Identifier | Ast.GeneralizedIdentifier =
            maybeIdentifierUnderPosition.node.kind === Ast.NodeKind.IdentifierExpression
                ? maybeIdentifierUnderPosition.node.identifier
                : maybeIdentifierUnderPosition.node;

        const context: HoverProviderContext = {
            traceManager: this.analysisSettings.traceManager,
            range: CommonTypesUtils.rangeFromTokenRange(identifier.tokenRange),
            identifier,
            maybeCancellationToken: cancellationToken,
            maybeInitialCorrelationId: trace.id,
            activeNode: maybeActiveNode,
            inspectionSettings: {
                ...this.analysisSettings.inspectionSettings,
                maybeCancellationToken: cancellationToken,
                maybeInitialCorrelationId: correlationId,
            },
            parseState: Assert.asDefined(await this.getParseState()),
            triedNodeScope: Assert.asDefined(await this.inspectNodeScope(maybeActiveNode, cancellationToken, trace.id)),
            triedScopeType: Assert.asDefined(await this.inspectScopeType(maybeActiveNode, cancellationToken, trace.id)),
        };

        trace.exit();

        return context;
    }

    private cancelPreviousTokenIfExists(id: string): void {
        const maybePreviousToken: ICancellationToken | undefined = this.cancellableTokensByAction.get(id);

        if (maybePreviousToken !== undefined) {
            maybePreviousToken.cancel();
        }
    }

    public async collectAllIdentifiersBeneath(
        nodeIdMapCollection: NodeIdMap.Collection,
        valueCreator: Ast.Identifier | Ast.GeneralizedIdentifier,
    ): Promise<Array<Ast.Identifier | Ast.GeneralizedIdentifier>> {
        const astNodeById: AstNodeById = nodeIdMapCollection.astNodeById;
        const childIdsById: ChildIdsById = nodeIdMapCollection.childIdsById;
        const originLiteral: string = valueCreator.literal;

        const entry: Ast.TNode | undefined = findDirectUpperScopeExpression(nodeIdMapCollection, valueCreator.id);

        if (entry) {
            const allIdentifierIdSet: Set<number> =
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Identifier) ?? new Set();

            const allGeneralizedIdentifierIdSet: Set<number> =
                nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.GeneralizedIdentifier) ?? new Set();

            const current: Ast.TNode = entry;
            const idsByTiers: number[][] = [];
            let currentTier: number[] = (childIdsById.get(current.id) ?? []).slice();

            while (currentTier.length) {
                const toBePushed: number[] = currentTier.filter(
                    (one: number) => allIdentifierIdSet.has(one) || allGeneralizedIdentifierIdSet.has(one),
                );

                toBePushed.length && idsByTiers.push(toBePushed);
                currentTier = currentTier.slice();
                let nextTier: number[] = [];

                while (currentTier.length) {
                    const oneNode: number = currentTier.shift() ?? -1;
                    const childrenOfTheNode: number[] = (childIdsById.get(oneNode) ?? []).slice();
                    nextTier = nextTier.concat(childrenOfTheNode);
                }

                currentTier = nextTier;
            }

            // filter literal names
            const completeIdentifierNodes: Array<Ast.Identifier | Ast.GeneralizedIdentifier> = idsByTiers
                .flat(1)
                .map((one: number) => astNodeById.get(one))
                .filter(Boolean) as Array<Ast.Identifier | Ast.GeneralizedIdentifier>;

            let filteredIdentifierNodes: Array<Ast.Identifier | Ast.GeneralizedIdentifier> =
                completeIdentifierNodes.filter(
                    (one: Ast.Identifier | Ast.GeneralizedIdentifier) => one.literal === originLiteral,
                );

            // populate the scope items for each
            await Promise.all(
                filteredIdentifierNodes
                    .filter(
                        (oneIdentifier: Ast.Identifier | Ast.GeneralizedIdentifier) =>
                            oneIdentifier.kind === Ast.NodeKind.GeneralizedIdentifier ||
                            oneIdentifier.identifierContextKind === Ast.IdentifierContextKind.Value,
                    )
                    .map((oneIdentifier: Ast.Identifier | Ast.GeneralizedIdentifier) =>
                        Inspection.tryNodeScope(
                            this.analysisSettings.inspectionSettings,
                            nodeIdMapCollection,
                            oneIdentifier.id,
                            this.typeCache.scopeById,
                        ),
                    ),
            );

            filteredIdentifierNodes = filteredIdentifierNodes.filter(
                (oneIdentifierNode: Ast.Identifier | Ast.GeneralizedIdentifier) => {
                    if (oneIdentifierNode.kind === Ast.NodeKind.GeneralizedIdentifier) {
                        return oneIdentifierNode.id === valueCreator.id;
                    } else if (oneIdentifierNode.identifierContextKind === Ast.IdentifierContextKind.Value) {
                        const theScope: Inspection.NodeScope | undefined = this.typeCache.scopeById.get(
                            oneIdentifierNode.id,
                        );

                        const theScopeItem: TScopeItem | undefined = findScopeItemByLiteral(theScope, originLiteral);

                        const theCreatorIdentifier: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
                            maybeScopeCreatorIdentifier(theScopeItem);

                        return theCreatorIdentifier && theCreatorIdentifier.id === valueCreator.id;
                    } else if (
                        oneIdentifierNode.identifierContextKind === Ast.IdentifierContextKind.Key ||
                        oneIdentifierNode.identifierContextKind === Ast.IdentifierContextKind.Parameter
                    ) {
                        return oneIdentifierNode.id === valueCreator.id;
                    }

                    return false;
                },
            );

            return filteredIdentifierNodes;
        }

        return [];
    }

    private async initializeState(): Promise<void> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.initializeState.name,
            this.analysisSettings.maybeInitialCorrelationId,
        );

        const updatedSettings: InspectionSettings = {
            ...this.analysisSettings.inspectionSettings,
            maybeInitialCorrelationId: trace.id,
        };

        const triedLexParse: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(
            updatedSettings,
            this.textDocument.getText(),
        );

        this.triedLexParse = triedLexParse;

        if (PQP.TaskUtils.isLexStageError(triedLexParse) || PQP.TaskUtils.isParseStageCommonError(triedLexParse)) {
            trace.exit({ [TraceConstant.IsError]: true });
        } else if (PQP.TaskUtils.isParseStageError(triedLexParse)) {
            this.parseState = triedLexParse.parseState;
            this.parseError = triedLexParse.error;
        } else {
            this.parseState = triedLexParse.parseState;
        }

        trace.exit();
    }

    // We should only get an undefined for activeNode iff no parsing has occurred
    private async getActiveNode(position: Position): Promise<TMaybeActiveNode | undefined> {
        const maybeParseState: PQP.Parser.ParseState | undefined = await this.getParseState();

        if (maybeParseState === undefined) {
            return undefined;
        }

        return ActiveNodeUtils.maybeActiveNode(maybeParseState.contextState.nodeIdMapCollection, position);
    }

    private async inspectAutocomplete(
        activeNode: TMaybeActiveNode,
        cancellationToken: ICancellationToken,
        correlationId: number,
    ): Promise<Inspection.Autocomplete | undefined> {
        const maybeParseState: PQP.Parser.ParseState | undefined = await this.getParseState();

        if (maybeParseState === undefined) {
            return undefined;
        }

        return await Inspection.autocomplete(
            {
                ...this.analysisSettings.inspectionSettings,
                maybeCancellationToken: cancellationToken,
                maybeInitialCorrelationId: correlationId,
            },
            maybeParseState,
            this.typeCache,
            activeNode,
            await this.getParseError(),
        );
    }

    private async inspectCurrentInvokeExpression(
        position: Position,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<Inspection.TriedCurrentInvokeExpression | undefined> {
        const maybeActiveNode: TMaybeActiveNode | undefined = await this.getActiveNode(position);
        const maybeParseState: PQP.Parser.ParseState | undefined = await this.getParseState();

        if (maybeActiveNode === undefined || maybeParseState === undefined) {
            return undefined;
        }

        return await Inspection.tryCurrentInvokeExpression(
            {
                ...this.analysisSettings.inspectionSettings,
                maybeCancellationToken: cancellationToken,
                maybeInitialCorrelationId: correlationId,
            },
            maybeParseState.contextState.nodeIdMapCollection,
            maybeActiveNode,
            this.typeCache,
        );
    }

    private async inspectNodeScope(
        activeNode: TMaybeActiveNode,
        cancellationToken: ICancellationToken,
        correlationId: number,
    ): Promise<Inspection.TriedNodeScope | undefined> {
        const maybeParseState: PQP.Parser.ParseState | undefined = await this.getParseState();

        if (maybeParseState === undefined || !ActiveNodeUtils.isPositionInBounds(activeNode)) {
            return undefined;
        }

        return await Inspection.tryNodeScope(
            {
                ...this.analysisSettings.inspectionSettings,
                maybeCancellationToken: cancellationToken,
                maybeInitialCorrelationId: correlationId,
            },
            maybeParseState.contextState.nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            this.typeCache.scopeById,
        );
    }

    private async inspectScopeType(
        activeNode: TMaybeActiveNode,
        cancellationToken: ICancellationToken,
        correlationId: number,
    ): Promise<Inspection.TriedScopeType | undefined> {
        const maybeParseState: PQP.Parser.ParseState | undefined = await this.getParseState();

        if (maybeParseState === undefined || !ActiveNodeUtils.isPositionInBounds(activeNode)) {
            return undefined;
        }

        return await Inspection.tryScopeType(
            {
                ...this.analysisSettings.inspectionSettings,
                maybeCancellationToken: cancellationToken,
                maybeInitialCorrelationId: correlationId,
            },
            maybeParseState.contextState.nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            this.typeCache,
        );
    }

    private async getParseState(): Promise<ParseState | undefined> {
        if (this.triedLexParse === undefined) {
            await this.initializeState();
        }

        return this.parseState;
    }

    private async getParseError(): Promise<ParseError.ParseError | undefined> {
        if (this.triedLexParse === undefined) {
            await this.initializeState();
        }

        return this.parseError;
    }
}
