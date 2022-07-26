// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser/lib/powerquery-parser";
import { Assert, CommonError, ICancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";
import {
    AstNodeById,
    ChildIdsById,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser/nodeIdMap/nodeIdMap";
import {
    DocumentSymbol,
    FoldingRange,
    Hover,
    Location,
    Position,
    SignatureHelp,
    SymbolKind,
} from "vscode-languageserver-types";
import {
    NodeIdMap,
    NodeIdMapUtils,
    ParseError,
    ParseState,
    TXorNode,
    XorNode,
    XorNodeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import { Trace, TraceConstant } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ActiveNodeUtils, TActiveLeafIdentifier, TMaybeActiveNode, TypeCache } from "../inspection";
import type {
    AutocompleteItemProviderContext,
    DefinitionProviderContext,
    HoverProviderContext,
    IAutocompleteItemProvider,
    ILibraryProvider,
    ILocalDocumentProvider,
    PartialSemanticToken,
    SignatureProviderContext,
} from "../providers/commonTypes";
import { CommonTypesUtils, Inspection, InspectionSettings, InspectionUtils, PositionUtils } from "..";
import {
    findDirectUpperScopeExpression,
    findScopeItemByLiteral,
    maybeScopeCreatorIdentifier,
    TScopeItem,
} from "../inspection/scope/scopeUtils";
import { LanguageAutocompleteItemProvider, LibraryProvider, LocalDocumentProvider } from "../providers";
import type { Analysis } from "./analysis";
import type { AnalysisSettings } from "./analysisSettings";
import { ValidationTraceConstant } from "../trace";

export abstract class AnalysisBase implements Analysis {
    protected languageAutocompleteItemProvider: IAutocompleteItemProvider;
    protected libraryProvider: ILibraryProvider;
    protected localDocumentProvider: ILocalDocumentProvider;

    protected cancellableTokensByAction: Map<string, ICancellationToken> = new Map();

    // Shared across actions
    protected parseError: ParseError.ParseError | undefined = undefined;
    protected parseState: ParseState | undefined = undefined;
    protected triedLexParse: PQP.Task.TriedLexParseTask | undefined = undefined;
    protected typeCache: TypeCache = {
        scopeById: new Map(),
        typeById: new Map(),
    };

    constructor(protected textDocument: TextDocument, protected analysisSettings: AnalysisSettings) {
        this.languageAutocompleteItemProvider = analysisSettings.maybeCreateLanguageAutocompleteItemProviderFn
            ? analysisSettings.maybeCreateLanguageAutocompleteItemProviderFn(analysisSettings.inspectionSettings.locale)
            : new LanguageAutocompleteItemProvider(analysisSettings.inspectionSettings.locale);

        this.libraryProvider = analysisSettings.maybeCreateLibraryProviderFn
            ? analysisSettings.maybeCreateLibraryProviderFn(
                  analysisSettings.inspectionSettings.library,
                  analysisSettings.inspectionSettings.locale,
              )
            : new LibraryProvider(
                  analysisSettings.inspectionSettings.library,
                  analysisSettings.inspectionSettings.locale,
              );

        this.localDocumentProvider = analysisSettings.maybeCreateLocalDocumentProviderFn
            ? analysisSettings.maybeCreateLocalDocumentProviderFn(
                  textDocument.uri.toString(),
                  this.typeCache,
                  analysisSettings.inspectionSettings.library,
                  analysisSettings.inspectionSettings.locale,
              )
            : new LocalDocumentProvider(
                  this.textDocument.uri.toString(),
                  this.typeCache,
                  analysisSettings.inspectionSettings.library,
                  analysisSettings.inspectionSettings.locale,
              );

        void this.initializeState();
    }

    public getAutocompleteItems(
        position: Position,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.analysisSettings.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getAutocompleteItems.name,
                this.analysisSettings.maybeInitialCorrelationId,
            );

            this.cancelPreviousTokenIfExists(this.getAutocompleteItems.name);

            const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
                this.getAutocompleteItems.name,
            );

            const maybeContext: AutocompleteItemProviderContext | undefined =
                await this.getAutocompleteItemProviderContext(position, trace.id, newCancellationToken);

            if (maybeContext === undefined) {
                trace.exit();

                return undefined;
            }

            const autocompleteItemTasks: Promise<
                Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>
            >[] = [
                this.languageAutocompleteItemProvider.getAutocompleteItems(maybeContext),
                this.libraryProvider.getAutocompleteItems(maybeContext),
                this.localDocumentProvider.getAutocompleteItems(maybeContext),
            ];

            const autocompleteItems: Inspection.AutocompleteItem[] = [];

            // TODO: intellisense improvements
            // - honor expected data type

            for (const result of await Promise.all(autocompleteItemTasks)) {
                if (ResultUtils.isOk(result) && result.value !== undefined) {
                    for (const item of result.value) {
                        autocompleteItems.push(item);
                    }
                }
            }

            trace.exit();

            return autocompleteItems;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public getDefinition(position: Position): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.analysisSettings.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getDefinition.name,
                this.analysisSettings.maybeInitialCorrelationId,
            );

            this.cancelPreviousTokenIfExists(this.getDefinition.name);

            const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
                this.getDefinition.name,
            );

            const maybeIdentifierContext: DefinitionProviderContext | undefined =
                await this.getDefinitionProviderContext(position, trace.id, newCancellationToken);

            if (!maybeIdentifierContext) {
                trace.exit();

                return undefined;
            }

            const result: Result<Location[] | undefined, CommonError.CommonError> =
                await this.localDocumentProvider.getDefinition(maybeIdentifierContext);

            trace.exit();

            if (ResultUtils.isError(result)) {
                throw result.error;
            }

            return result.value;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public getDocumentSymbols(): Promise<PQP.Result<DocumentSymbol[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const maybeParseState: ParseState | undefined = await this.getParseState();

            if (maybeParseState === undefined) {
                return undefined;
            }

            const nodeIdMapCollection: NodeIdMap.Collection = maybeParseState.contextState.nodeIdMapCollection;
            const currentSymbols: DocumentSymbol[] = [];
            const parentSymbolById: Map<number, DocumentSymbol> = new Map();

            addIdentifierPairedExpressionSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById);
            addRecordSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById);

            return currentSymbols;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public getFoldingRanges(): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
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

                return undefined;
            }

            const result: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await this.localDocumentProvider.getFoldingRanges({
                    traceManager: this.analysisSettings.traceManager,
                    maybeInitialCorrelationId: trace.id,
                    maybeCancellationToken: newCancellationToken,
                    nodeIdMapCollection: maybeParseState.contextState.nodeIdMapCollection,
                });

            trace.exit();

            if (ResultUtils.isError(result)) {
                throw result.error;
            }

            return result.value;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public getHover(position: Position): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
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

                return undefined;
            }

            const triedHovers: Result<Hover | undefined, CommonError.CommonError>[] = await Promise.all([
                this.localDocumentProvider.getHover(maybeHoverProviderContext),
                this.libraryProvider.getHover(maybeHoverProviderContext),
            ]);

            for (const triedHover of triedHovers) {
                if (ResultUtils.isOk(triedHover) && triedHover.value) {
                    trace.exit();

                    return triedHover.value;
                }
            }

            trace.exit();

            return undefined;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public async getParseError(): Promise<ParseError.ParseError | undefined> {
        if (this.triedLexParse === undefined) {
            await this.initializeState();
        }

        return this.parseError;
    }

    public async getParseState(): Promise<ParseState | undefined> {
        if (this.triedLexParse === undefined) {
            await this.initializeState();
        }

        return this.parseState;
    }

    public getPartialSemanticTokens(): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
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

            if (ResultUtils.isError(result)) {
                throw result.error;
            }

            return result.value;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public getSignatureHelp(position: Position): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.analysisSettings.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getSignatureHelp.name,
                this.analysisSettings.maybeInitialCorrelationId,
            );

            this.cancelPreviousTokenIfExists(this.getSignatureHelp.name);

            const newCancellationToken: ICancellationToken = this.analysisSettings.createCancellationTokenFn(
                this.getSignatureHelp.name,
            );

            const maybeContext: SignatureProviderContext | undefined = await this.getSignatureProviderContext(
                position,
                trace.id,
                newCancellationToken,
            );

            if (maybeContext === undefined) {
                trace.exit();

                return undefined;
            }

            const signatureTasks: Result<SignatureHelp | undefined, CommonError.CommonError>[] = await Promise.all([
                this.localDocumentProvider.getSignatureHelp(maybeContext),
                this.libraryProvider.getSignatureHelp(maybeContext),
            ]);

            for (const task of signatureTasks) {
                if (ResultUtils.isOk(task) && task.value !== undefined) {
                    trace.exit();

                    return task.value;
                }
            }

            trace.exit();

            return undefined;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public getRenameEdits(
        position: Position,
        newName: string,
    ): Promise<Result<TextEdit[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
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

                return undefined;
            } else {
                maybeLeafIdentifier = maybeActiveNode.maybeInclusiveIdentifierUnderPosition;
            }

            void (await this.inspectNodeScope(maybeActiveNode, trace.id, newCancellationToken));
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

            return result;
        }, this.analysisSettings.inspectionSettings.locale);
    }

    public abstract dispose(): void;

    // protected abstract getText(range?: Range): string;

    protected static isValidHoverIdentifier(activeNode: Inspection.ActiveNode): boolean {
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

    protected async getAutocompleteItemProviderContext(
        position: Position,
        correlationId: number,
        newCancellationToken: ICancellationToken,
    ): Promise<AutocompleteItemProviderContext | undefined> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getAutocompleteItemProviderContext.name,
            correlationId,
        );

        const maybeActiveNode: TMaybeActiveNode | undefined = await this.getActiveNode(position);

        if (maybeActiveNode === undefined) {
            trace.exit();

            return undefined;
        }

        const autocomplete: Inspection.Autocomplete = Assert.asDefined(
            await this.inspectAutocomplete(maybeActiveNode, trace.id, newCancellationToken),
        );

        const triedNodeScope: Inspection.TriedNodeScope = Assert.asDefined(
            await this.inspectNodeScope(maybeActiveNode, trace.id, newCancellationToken),
        );

        const triedScopeType: Inspection.TriedScopeType = Assert.asDefined(
            await this.inspectScopeType(maybeActiveNode, trace.id, newCancellationToken),
        );

        const maybeActiveLeafIdentifier: TActiveLeafIdentifier | undefined = ActiveNodeUtils.isPositionInBounds(
            maybeActiveNode,
        )
            ? maybeActiveNode.maybeInclusiveIdentifierUnderPosition
            : undefined;

        let result: AutocompleteItemProviderContext;

        if (maybeActiveLeafIdentifier !== undefined) {
            result = {
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
            result = {
                autocomplete,
                triedNodeScope,
                triedScopeType,
                traceManager: this.analysisSettings.traceManager,
                maybeCancellationToken: newCancellationToken,
                maybeInitialCorrelationId: trace.id,
            };
        }

        trace.exit();

        return result;
    }

    protected async getDefinitionProviderContext(
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
            triedNodeScope: Assert.asDefined(await this.inspectNodeScope(maybeActiveNode, trace.id, cancellationToken)),
        };

        trace.exit();

        return context;
    }

    protected async getHoverProviderContext(
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
            triedNodeScope: Assert.asDefined(await this.inspectNodeScope(maybeActiveNode, trace.id, cancellationToken)),
            triedScopeType: Assert.asDefined(await this.inspectScopeType(maybeActiveNode, trace.id, cancellationToken)),
        };

        trace.exit();

        return context;
    }

    protected async getSignatureProviderContext(
        position: Position,
        correlationId: number,
        newCancellationToken: ICancellationToken,
    ): Promise<SignatureProviderContext | undefined> {
        const trace: Trace = this.analysisSettings.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getSignatureProviderContext.name,
            correlationId,
        );

        const triedCurrentInvokeExpression: Inspection.TriedCurrentInvokeExpression | undefined =
            await this.inspectCurrentInvokeExpression(position, trace.id, newCancellationToken);

        if (
            triedCurrentInvokeExpression === undefined ||
            ResultUtils.isError(triedCurrentInvokeExpression) ||
            triedCurrentInvokeExpression.value === undefined
        ) {
            trace.exit();

            return undefined;
        }

        const invokeExpression: Inspection.CurrentInvokeExpression = triedCurrentInvokeExpression.value;

        const functionName: string | undefined =
            invokeExpression.maybeName !== undefined ? invokeExpression.maybeName : undefined;

        const argumentOrdinal: number | undefined =
            invokeExpression.maybeArguments !== undefined ? invokeExpression.maybeArguments.argumentOrdinal : undefined;

        if (functionName === undefined || argumentOrdinal === undefined) {
            trace.exit();

            return undefined;
        }

        const result: SignatureProviderContext = {
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

        trace.exit();

        return result;
    }

    public getTypeCache(): TypeCache {
        return this.typeCache;
    }

    protected cancelPreviousTokenIfExists(id: string): void {
        const maybePreviousToken: ICancellationToken | undefined = this.cancellableTokensByAction.get(id);

        if (maybePreviousToken !== undefined) {
            maybePreviousToken.cancel();
        }
    }

    protected async collectAllIdentifiersBeneath(
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

    protected async initializeState(): Promise<void> {
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
    protected async getActiveNode(position: Position): Promise<TMaybeActiveNode | undefined> {
        const maybeParseState: ParseState | undefined = await this.getParseState();

        if (maybeParseState === undefined) {
            return undefined;
        }

        return ActiveNodeUtils.maybeActiveNode(maybeParseState.contextState.nodeIdMapCollection, position);
    }

    protected async inspectAutocomplete(
        activeNode: TMaybeActiveNode,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<Inspection.Autocomplete | undefined> {
        const maybeParseState: ParseState | undefined = await this.getParseState();

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

    protected async inspectCurrentInvokeExpression(
        position: Position,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<Inspection.TriedCurrentInvokeExpression | undefined> {
        const maybeActiveNode: TMaybeActiveNode | undefined = await this.getActiveNode(position);
        const maybeParseState: ParseState | undefined = await this.getParseState();

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

    protected async inspectNodeScope(
        activeNode: TMaybeActiveNode,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<Inspection.TriedNodeScope | undefined> {
        const maybeParseState: ParseState | undefined = await this.getParseState();

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

    protected async inspectScopeType(
        activeNode: TMaybeActiveNode,
        correlationId: number,
        cancellationToken: ICancellationToken,
    ): Promise<Inspection.TriedScopeType | undefined> {
        const maybeParseState: ParseState | undefined = await this.getParseState();

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
}

function addIdentifierPairedExpressionSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
): void {
    const identifierPairedExpressionIds: Set<number> =
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierPairedExpression) ?? new Set();

    for (const nodeId of identifierPairedExpressionIds) {
        const xorNode: XorNode<Ast.IdentifierPairedExpression> =
            NodeIdMapUtils.assertGetXorChecked<Ast.IdentifierPairedExpression>(
                nodeIdMapCollection,
                nodeId,
                Ast.NodeKind.IdentifierPairedExpression,
            );

        if (!XorNodeUtils.isAstXor(xorNode)) {
            continue;
        }

        const astNode: Ast.IdentifierPairedExpression = xorNode.node;
        const documentSymbol: DocumentSymbol = InspectionUtils.getSymbolForIdentifierPairedExpression(astNode);
        addDocumentSymbols(nodeIdMapCollection, parentSymbolById, nodeId, currentSymbols, documentSymbol);
        parentSymbolById.set(nodeId, documentSymbol);
    }
}

function addRecordSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
): void {
    const recordIdCollections: ReadonlyArray<Set<number>> = [
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression) ?? new Set(),
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordLiteral) ?? new Set(),
    ];

    for (const collection of recordIdCollections) {
        for (const nodeId of collection) {
            const xorNode: XorNode<Ast.RecordExpression | Ast.RecordLiteral> = NodeIdMapUtils.assertGetXorChecked<
                Ast.RecordExpression | Ast.RecordLiteral
            >(nodeIdMapCollection, nodeId, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);

            if (!XorNodeUtils.isAstXor(xorNode)) {
                continue;
            }

            const astNode: Ast.RecordExpression | Ast.RecordLiteral = xorNode.node;

            // Process the record if the immediate parent is a Struct
            const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(astNode.id);
            const parentSymbol: DocumentSymbol | undefined = parentId ? parentSymbolById.get(parentId) : undefined;

            if (parentSymbol && parentSymbol.kind === SymbolKind.Struct) {
                const fieldSymbols: ReadonlyArray<DocumentSymbol> = InspectionUtils.getSymbolsForRecord(astNode);

                if (fieldSymbols.length > 0) {
                    addDocumentSymbols(
                        nodeIdMapCollection,
                        parentSymbolById,
                        astNode.id,
                        currentSymbols,
                        ...fieldSymbols,
                    );
                }
            }
        }
    }
}

function addDocumentSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentSymbolById: Map<number, DocumentSymbol>,
    nodeId: number,
    currentSymbols: DocumentSymbol[],
    ...newSymbols: DocumentSymbol[]
): void {
    const parentSymbol: DocumentSymbol | undefined = findParentSymbol(nodeIdMapCollection, parentSymbolById, nodeId);

    if (parentSymbol) {
        if (!parentSymbol.children) {
            parentSymbol.children = [];
        }

        parentSymbol.children.push(...newSymbols);

        return;
    }

    // Add to the top level
    currentSymbols.push(...newSymbols);
}

function findParentSymbol(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentSymbolById: Map<number, DocumentSymbol>,
    nodeId: number,
): DocumentSymbol | undefined {
    // Get parent for current node
    const parentNodeId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);

    if (!parentNodeId) {
        // No more parents to check
        return undefined;
    }

    let parentSymbol: DocumentSymbol | undefined = parentSymbolById.get(parentNodeId);

    if (!parentSymbol) {
        parentSymbol = findParentSymbol(nodeIdMapCollection, parentSymbolById, parentNodeId);
    }

    return parentSymbol;
}
