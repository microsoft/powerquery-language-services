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
import { Trace, TraceConstant, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ActiveNodeUtils, TActiveLeafIdentifier, TActiveNode, TypeCache } from "../inspection";
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
    scopeCreatorIdentifier,
    TScopeItem,
} from "../inspection/scope/scopeUtils";
import { LanguageAutocompleteItemProvider, LibraryProvider, LocalDocumentProvider } from "../providers";
import type { Analysis } from "./analysis";
import type { AnalysisSettings } from "./analysisSettings";
import { ValidationTraceConstant } from "../trace";

// Implementation of Analysis.
// All public methods should:
//  - use ensureResultAsync to ensure a Result, allowing all protected methods to safetly throw.
//  - take an optional cancellation token.
export class AnalysisBase implements Analysis {
    protected initialCorrelationId: number | undefined;
    protected inspectionSettings: InspectionSettings;
    protected locale: string;
    protected traceManager: TraceManager;

    protected languageAutocompleteItemProvider: IAutocompleteItemProvider;
    protected libraryProvider: ILibraryProvider;
    protected localDocumentProvider: ILocalDocumentProvider;

    // A promise holding the lex and parse attempt on the TextDocument which is triggered on instantiation.
    protected triedLexParse: Promise<PQP.Task.TriedLexParseTask>;
    // Local type cache that is shared across provider actions.
    protected typeCache: TypeCache = {
        scopeById: new Map(),
        typeById: new Map(),
    };

    constructor(protected textDocument: TextDocument, analysisSettings: AnalysisSettings) {
        this.initialCorrelationId = analysisSettings.initialCorrelationId;
        this.inspectionSettings = analysisSettings.inspectionSettings;
        this.locale = analysisSettings.inspectionSettings.locale;
        this.traceManager = analysisSettings.traceManager;

        this.languageAutocompleteItemProvider = analysisSettings.languageAutocompleteItemProviderFactory
            ? analysisSettings.languageAutocompleteItemProviderFactory(analysisSettings.inspectionSettings.locale)
            : new LanguageAutocompleteItemProvider(analysisSettings.inspectionSettings.locale);

        this.libraryProvider = analysisSettings.libraryProviderFactory
            ? analysisSettings.libraryProviderFactory(
                  analysisSettings.inspectionSettings.library,
                  analysisSettings.inspectionSettings.locale,
              )
            : new LibraryProvider(
                  analysisSettings.inspectionSettings.library,
                  analysisSettings.inspectionSettings.locale,
              );

        this.localDocumentProvider = analysisSettings.localDocumentProviderFactory
            ? analysisSettings.localDocumentProviderFactory(
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

        this.triedLexParse = this.tryLexParse();
    }

    public getAutocompleteItems(
        position: Position,
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getAutocompleteItems.name,
                this.initialCorrelationId,
            );

            const context: AutocompleteItemProviderContext | undefined = await this.getAutocompleteItemProviderContext(
                position,
                trace.id,
                cancellationTokenOverride,
            );

            if (context === undefined) {
                trace.exit();

                return undefined;
            }

            const autocompleteItemTasks: Promise<
                Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>
            >[] = [
                this.languageAutocompleteItemProvider.getAutocompleteItems(context),
                this.libraryProvider.getAutocompleteItems(context),
                this.localDocumentProvider.getAutocompleteItems(context),
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
        }, this.locale);
    }

    public getDefinition(
        position: Position,
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getDefinition.name,
                this.initialCorrelationId,
            );

            const identifierContext: DefinitionProviderContext | undefined = await this.getDefinitionProviderContext(
                position,
                trace.id,
                cancellationTokenOverride,
            );

            if (!identifierContext) {
                trace.exit();

                return undefined;
            }

            const result: Result<Location[] | undefined, CommonError.CommonError> =
                await this.localDocumentProvider.getDefinition(identifierContext);

            if (ResultUtils.isError(result)) {
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw result.error;
            }

            trace.exit();

            return result.value;
        }, this.locale);
    }

    public getDocumentSymbols(
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<PQP.Result<DocumentSymbol[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(undefined);

            if (parseState === undefined) {
                return undefined;
            }

            const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
            const currentSymbols: DocumentSymbol[] = [];
            const parentSymbolById: Map<number, DocumentSymbol> = new Map();

            const cancellationToken: ICancellationToken | undefined =
                cancellationTokenOverride ?? this.inspectionSettings.cancellationToken;

            addIdentifierPairedExpressionSymbols(
                nodeIdMapCollection,
                currentSymbols,
                parentSymbolById,
                cancellationToken,
            );

            addRecordSymbols(nodeIdMapCollection, currentSymbols, parentSymbolById, cancellationToken);

            return currentSymbols;
        }, this.locale);
    }

    public getFoldingRanges(
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<FoldingRange[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getFoldingRanges.name,
                this.initialCorrelationId,
            );

            const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(trace);

            if (parseState === undefined) {
                trace.exit();

                return undefined;
            }

            const result: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await this.localDocumentProvider.getFoldingRanges({
                    traceManager: this.traceManager,
                    initialCorrelationId: trace.id,
                    cancellationToken: cancellationTokenOverride ?? this.inspectionSettings.cancellationToken,
                    nodeIdMapCollection: parseState.contextState.nodeIdMapCollection,
                });

            if (ResultUtils.isError(result)) {
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw result.error;
            }

            trace.exit();

            return result.value;
        }, this.locale);
    }

    public getHover(
        position: Position,
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getHover.name,
                this.initialCorrelationId,
            );

            const hoverProviderContext: HoverProviderContext | undefined = await this.getHoverProviderContext(
                position,
                trace.id,
                cancellationTokenOverride,
            );

            if (!hoverProviderContext) {
                trace.exit();

                return undefined;
            }

            const triedHovers: Result<Hover | undefined, CommonError.CommonError>[] = await Promise.all([
                this.localDocumentProvider.getHover(hoverProviderContext),
                this.libraryProvider.getHover(hoverProviderContext),
            ]);

            // Keep track if any error was thrown, prioritized by the order of the providers
            let firstError: CommonError.CommonError | undefined;

            for (const triedHover of triedHovers) {
                if (ResultUtils.isOk(triedHover)) {
                    if (triedHover.value !== undefined) {
                        trace.exit();

                        return triedHover.value;
                    }
                } else if (firstError === undefined) {
                    firstError = triedHover.error;
                }
            }

            if (firstError !== undefined) {
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw firstError;
            }

            trace.exit();

            return undefined;
        }, this.locale);
    }

    // We should only get an undefined for an activeNode iff a parse pass hasn't been done.
    public getActiveNode(position: Position): Promise<Result<TActiveNode | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(undefined);

            if (parseState === undefined) {
                return undefined;
            }

            return ActiveNodeUtils.activeNode(parseState.contextState.nodeIdMapCollection, position);
        }, this.locale);
    }

    // undefined means either the parse pass wasn't done (lexing error), or there was no error.
    public getParseError(): Promise<Result<ParseError.ParseError | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const triedLexParse: PQP.Task.TriedLexParseTask = await this.triedLexParse;

            if (PQP.TaskUtils.isParseStageCommonError(triedLexParse)) {
                throw triedLexParse.error;
            } else if (PQP.TaskUtils.isParseStageError(triedLexParse)) {
                return triedLexParse.error;
            } else {
                return undefined;
            }
        }, this.locale);
    }

    // We should only get an undefined for an activeNode iff a parse pass hasn't been done.
    public getParseState(): Promise<Result<ParseState | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const triedLexParse: PQP.Task.TriedLexParseTask = await this.triedLexParse;

            if (PQP.TaskUtils.isParseStageCommonError(triedLexParse)) {
                throw triedLexParse.error;
            } else if (PQP.TaskUtils.isParseStageError(triedLexParse)) {
                return triedLexParse.parseState;
            } else if (PQP.TaskUtils.isParseStageOk(triedLexParse)) {
                return triedLexParse.parseState;
            } else {
                return undefined;
            }
        }, this.locale);
    }

    public getPartialSemanticTokens(
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getPartialSemanticTokens.name,
                this.initialCorrelationId,
            );

            const parseState: PQP.Parser.ParseState | undefined = await this.getParseStateOkOrThrow(trace);

            if (parseState === undefined) {
                trace.exit();

                return undefined;
            }

            const result: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await this.localDocumentProvider.getPartialSemanticTokens({
                    traceManager: this.traceManager,
                    initialCorrelationId: trace.id,
                    cancellationToken: cancellationTokenOverride ?? this.inspectionSettings.cancellationToken,
                    library: this.inspectionSettings.library,
                    parseState,
                });

            if (ResultUtils.isError(result)) {
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw result.error;
            }

            trace.exit();

            return result.value;
        }, this.locale);
    }

    public getSignatureHelp(
        position: Position,
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getSignatureHelp.name,
                this.initialCorrelationId,
            );

            const signatureProviderContext: SignatureProviderContext | undefined =
                await this.getSignatureProviderContext(position, trace.id, cancellationTokenOverride);

            if (signatureProviderContext === undefined) {
                trace.exit();

                return undefined;
            }

            const signatureTasks: Result<SignatureHelp | undefined, CommonError.CommonError>[] = await Promise.all([
                this.localDocumentProvider.getSignatureHelp(signatureProviderContext),
                this.libraryProvider.getSignatureHelp(signatureProviderContext),
            ]);

            for (const task of signatureTasks) {
                if (ResultUtils.isOk(task) && task.value !== undefined) {
                    trace.exit();

                    return task.value;
                }
            }

            trace.exit();

            return undefined;
        }, this.locale);
    }

    public getRenameEdits(
        position: Position,
        newName: string,
        cancellationTokenOverride?: ICancellationToken | undefined,
    ): Promise<Result<TextEdit[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = this.traceManager.entry(
                ValidationTraceConstant.AnalysisBase,
                this.getRenameEdits.name,
                this.initialCorrelationId,
            );

            const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(trace);
            const activeNode: TActiveNode | undefined = await this.getActiveNodeOkOrThrow(position, trace);

            if (
                parseState === undefined ||
                activeNode === undefined ||
                !ActiveNodeUtils.isPositionInBounds(activeNode) ||
                activeNode.inclusiveIdentifierUnderPosition === undefined
            ) {
                trace.exit();

                return undefined;
            }

            void (await this.inspectNodeScope(activeNode, trace.id, cancellationTokenOverride));
            const leafIdentifier: TActiveLeafIdentifier = activeNode.inclusiveIdentifierUnderPosition;
            const scopeById: Inspection.ScopeById = this.typeCache.scopeById;

            const identifiersToBeEdited: (Ast.Identifier | Ast.GeneralizedIdentifier)[] = [];
            let valueCreator: Ast.Identifier | Ast.GeneralizedIdentifier | undefined = undefined;

            if (leafIdentifier.node.kind === Ast.NodeKind.GeneralizedIdentifier) {
                valueCreator = leafIdentifier.node;
            } else if (
                (leafIdentifier.node.kind === Ast.NodeKind.Identifier ||
                    leafIdentifier.node.kind === Ast.NodeKind.IdentifierExpression) &&
                scopeById
            ) {
                // need to find this key value and modify all referring it
                const identifierExpression: Ast.Identifier =
                    leafIdentifier.node.kind === Ast.NodeKind.IdentifierExpression
                        ? leafIdentifier.node.identifier
                        : leafIdentifier.node;

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
                                this.inspectionSettings,
                                parseState.contextState.nodeIdMapCollection,
                                identifierExpression.id,
                                scopeById,
                            ));

                            nodeScope = scopeById.get(identifierExpression.id);
                        }

                        const scopeItem: Inspection.TScopeItem | undefined = findScopeItemByLiteral(
                            nodeScope,
                            leafIdentifier.normalizedLiteral,
                        );

                        if (scopeItem) {
                            const valueCreatorSearch: Ast.Identifier | Ast.GeneralizedIdentifier | undefined =
                                scopeCreatorIdentifier(scopeItem);

                            if (valueCreatorSearch?.kind === Ast.NodeKind.Identifier) {
                                if (
                                    valueCreatorSearch.identifierContextKind === Ast.IdentifierContextKind.Key ||
                                    valueCreatorSearch.identifierContextKind === Ast.IdentifierContextKind.Parameter
                                ) {
                                    valueCreator = valueCreatorSearch;
                                } else {
                                    identifiersToBeEdited.push(valueCreatorSearch);
                                }
                            } else if (valueCreatorSearch?.kind === Ast.NodeKind.GeneralizedIdentifier) {
                                valueCreator = valueCreatorSearch;
                            } else if (valueCreatorSearch) {
                                identifiersToBeEdited.push(valueCreatorSearch);
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
                        parseState.contextState.nodeIdMapCollection,
                        valueCreator,
                    )),
                );
            }

            // if none found, directly put inclusiveIdentifierUnderPosition in if it exists
            if (identifiersToBeEdited.length === 0 && leafIdentifier) {
                identifiersToBeEdited.push(
                    leafIdentifier.node.kind === Ast.NodeKind.IdentifierExpression
                        ? leafIdentifier.node.identifier
                        : leafIdentifier.node,
                );
            }

            const result: TextEdit[] = identifiersToBeEdited.map((one: Ast.Identifier | Ast.GeneralizedIdentifier) => ({
                range: PositionUtils.rangeFromTokenRange(one.tokenRange),
                newText: newName,
            }));

            trace.exit();

            return result;
        }, this.locale);
    }

    public dispose(): void {
        this.typeCache.scopeById.clear();
        this.typeCache.typeById.clear();
    }

    protected static isValidHoverIdentifier(activeNode: Inspection.ActiveNode): boolean {
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        const parent: TXorNode | undefined = ancestry[1];

        if (parent?.node?.kind === Ast.NodeKind.Parameter) {
            return false;
        }

        return true;
    }

    protected async getAutocompleteItemProviderContext(
        position: Position,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<AutocompleteItemProviderContext | undefined> {
        const trace: Trace = this.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getAutocompleteItemProviderContext.name,
            correlationId,
        );

        const activeNode: TActiveNode | undefined = await this.getActiveNodeOkOrThrow(position, trace);

        if (activeNode === undefined) {
            trace.exit();

            return undefined;
        }

        const autocomplete: Inspection.Autocomplete = Assert.asDefined(
            await this.inspectAutocomplete(activeNode, trace.id, cancellationTokenOverride),
            "we have a truthy activeNode meaning we have a truthy parseState",
        );

        const triedNodeScope: Inspection.TriedNodeScope = Assert.asDefined(
            await this.inspectNodeScope(activeNode, trace.id, cancellationTokenOverride),
            "we have a truthy activeNode meaning we have a truthy parseState",
        );

        const triedScopeType: Inspection.TriedScopeType = Assert.asDefined(
            await this.inspectScopeType(activeNode, trace.id, cancellationTokenOverride),
            "we have a truthy activeNode meaning we have a truthy parseState",
        );

        const activeLeafIdentifier: TActiveLeafIdentifier | undefined = ActiveNodeUtils.isPositionInBounds(activeNode)
            ? activeNode.inclusiveIdentifierUnderPosition
            : undefined;

        let result: AutocompleteItemProviderContext;

        const cancellationToken: ICancellationToken | undefined =
            cancellationTokenOverride ?? this.inspectionSettings.cancellationToken;

        if (activeLeafIdentifier !== undefined) {
            result = {
                autocomplete,
                triedNodeScope,
                triedScopeType,
                traceManager: this.traceManager,
                cancellationToken,
                initialCorrelationId: trace.id,
                range: CommonTypesUtils.rangeFromTokenRange(activeLeafIdentifier.node.tokenRange),
                text: activeLeafIdentifier.normalizedLiteral,
                tokenKind: activeLeafIdentifier.node.kind,
            };
        } else {
            result = {
                autocomplete,
                triedNodeScope,
                triedScopeType,
                traceManager: this.traceManager,
                cancellationToken,
                initialCorrelationId: trace.id,
            };
        }

        trace.exit();

        return result;
    }

    protected async getDefinitionProviderContext(
        position: Position,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<DefinitionProviderContext | undefined> {
        const trace: Trace = this.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getDefinitionProviderContext.name,
            correlationId,
        );

        const activeNode: Inspection.TActiveNode | undefined = await this.getActiveNodeOkOrThrow(position, trace);

        if (
            activeNode === undefined ||
            !ActiveNodeUtils.isPositionInBounds(activeNode) ||
            activeNode.exclusiveIdentifierUnderPosition === undefined ||
            !AnalysisBase.isValidHoverIdentifier(activeNode)
        ) {
            trace.exit();

            return undefined;
        }

        const identifierUnderPosition: TActiveLeafIdentifier = activeNode.exclusiveIdentifierUnderPosition;

        const identifier: Ast.Identifier | Ast.GeneralizedIdentifier =
            identifierUnderPosition.node.kind === Ast.NodeKind.IdentifierExpression
                ? identifierUnderPosition.node.identifier
                : identifierUnderPosition.node;

        const cancellationToken: ICancellationToken | undefined =
            cancellationTokenOverride ?? this.inspectionSettings.cancellationToken;

        const context: DefinitionProviderContext = {
            traceManager: this.traceManager,
            range: CommonTypesUtils.rangeFromTokenRange(identifier.tokenRange),
            initialCorrelationId: trace.id,
            cancellationToken,
            identifier,
            triedNodeScope: Assert.asDefined(
                await this.inspectNodeScope(activeNode, trace.id, cancellationToken),
                "we got a truthy activeNode meaning we have a truthy parseState",
            ),
        };

        trace.exit();

        return context;
    }

    protected async getHoverProviderContext(
        position: Position,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<HoverProviderContext | undefined> {
        const trace: Trace = this.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getHoverProviderContext.name,
            correlationId,
        );

        const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(trace);
        const activeNode: Inspection.TActiveNode | undefined = await this.getActiveNodeOkOrThrow(position, trace);

        if (parseState === undefined || activeNode === undefined || !ActiveNodeUtils.isPositionInBounds(activeNode)) {
            trace.exit();

            return undefined;
        }

        const identifierUnderPosition: TActiveLeafIdentifier | undefined = activeNode.exclusiveIdentifierUnderPosition;

        if (identifierUnderPosition === undefined || !AnalysisBase.isValidHoverIdentifier(activeNode)) {
            trace.exit();

            return undefined;
        }

        const cancellationToken: ICancellationToken | undefined =
            cancellationTokenOverride ?? this.inspectionSettings.cancellationToken;

        const identifier: Ast.Identifier | Ast.GeneralizedIdentifier =
            identifierUnderPosition.node.kind === Ast.NodeKind.IdentifierExpression
                ? identifierUnderPosition.node.identifier
                : identifierUnderPosition.node;

        const context: HoverProviderContext = {
            traceManager: this.traceManager,
            range: CommonTypesUtils.rangeFromTokenRange(identifier.tokenRange),
            identifier,
            cancellationToken,
            initialCorrelationId: trace.id,
            activeNode,
            inspectionSettings: {
                ...this.inspectionSettings,
                cancellationToken,
                initialCorrelationId: correlationId,
            },
            parseState,
            triedNodeScope: Assert.asDefined(
                await this.inspectNodeScope(activeNode, trace.id, cancellationToken),
                "we have a truthy activeNode meaning we have a truthy parseState",
            ),
            triedScopeType: Assert.asDefined(
                await this.inspectScopeType(activeNode, trace.id, cancellationToken),
                "we have a truthy activeNode meaning we have a truthy parseState",
            ),
        };

        trace.exit();

        return context;
    }

    protected async getSignatureProviderContext(
        position: Position,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<SignatureProviderContext | undefined> {
        const trace: Trace = this.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.getSignatureProviderContext.name,
            correlationId,
        );

        const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(trace);
        const activeNode: TActiveNode | undefined = await this.getActiveNodeOkOrThrow(position, trace);

        const triedCurrentInvokeExpression: Inspection.TriedCurrentInvokeExpression | undefined =
            await this.inspectCurrentInvokeExpression(position, trace.id, cancellationTokenOverride);

        if (
            parseState === undefined ||
            activeNode === undefined ||
            triedCurrentInvokeExpression === undefined ||
            ResultUtils.isError(triedCurrentInvokeExpression) ||
            triedCurrentInvokeExpression.value === undefined
        ) {
            trace.exit();

            return undefined;
        }

        const invokeExpression: Inspection.CurrentInvokeExpression = triedCurrentInvokeExpression.value;

        const functionName: string | undefined =
            invokeExpression.name !== undefined ? invokeExpression.name : undefined;

        const argumentOrdinal: number | undefined =
            invokeExpression.arguments !== undefined ? invokeExpression.arguments.argumentOrdinal : undefined;

        if (functionName === undefined || argumentOrdinal === undefined) {
            trace.exit();

            return undefined;
        }

        const cancellationToken: ICancellationToken | undefined =
            cancellationTokenOverride ?? this.inspectionSettings.cancellationToken;

        const result: SignatureProviderContext = {
            argumentOrdinal,
            functionName,
            isNameInLocalScope: invokeExpression.isNameInLocalScope,
            functionType: invokeExpression.functionType,
            traceManager: this.traceManager,
            cancellationToken,
            initialCorrelationId: trace.id,
            triedCurrentInvokeExpression: await Inspection.tryCurrentInvokeExpression(
                {
                    ...this.inspectionSettings,
                    cancellationToken,
                    initialCorrelationId: trace.id,
                },
                parseState.contextState.nodeIdMapCollection,
                activeNode,
                this.typeCache,
            ),
        };

        trace.exit();

        return result;
    }

    public getTypeCache(): TypeCache {
        return this.typeCache;
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
                            this.inspectionSettings,
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
                            scopeCreatorIdentifier(theScopeItem);

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

    // Performs a lex + parse of the document, then caches the results into local variables.
    // Any code which operates on the parse state should use this method to ensure that the parse state is initialized.
    protected async tryLexParse(): Promise<PQP.Task.TriedLexParseTask> {
        const trace: Trace = this.traceManager.entry(
            ValidationTraceConstant.AnalysisBase,
            this.tryLexParse.name,
            this.initialCorrelationId,
        );

        const updatedSettings: InspectionSettings = {
            ...this.inspectionSettings,
            initialCorrelationId: trace.id,
        };

        const triedLexParse: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(
            updatedSettings,
            this.textDocument.getText(),
        );

        trace.exit();

        return triedLexParse;
    }

    protected async inspectAutocomplete(
        activeNode: TActiveNode,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<Inspection.Autocomplete | undefined> {
        const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(undefined);
        const parseError: ParseError.ParseError | undefined = await this.getParseErrorOkOrThrow(undefined);

        if (parseState === undefined) {
            return undefined;
        }

        return await Inspection.autocomplete(
            {
                ...this.inspectionSettings,
                initialCorrelationId: correlationId,
                cancellationToken: cancellationTokenOverride ?? this.inspectionSettings.cancellationToken,
            },
            parseState,
            this.typeCache,
            activeNode,
            parseError,
        );
    }

    protected async inspectCurrentInvokeExpression(
        position: Position,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<Inspection.TriedCurrentInvokeExpression | undefined> {
        const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(undefined);

        // parseState needs to be ok, and must be truthy.
        const activeNode: TActiveNode | undefined = await this.getActiveNodeOkOrThrow(position, undefined);

        if (parseState === undefined || activeNode === undefined) {
            return undefined;
        }

        return await Inspection.tryCurrentInvokeExpression(
            {
                ...this.inspectionSettings,
                initialCorrelationId: correlationId,
                cancellationToken: cancellationTokenOverride ?? this.inspectionSettings.cancellationToken,
            },
            parseState.contextState.nodeIdMapCollection,
            activeNode,
            this.typeCache,
        );
    }

    protected async inspectNodeScope(
        activeNode: TActiveNode,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<Inspection.TriedNodeScope | undefined> {
        const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(undefined);

        if (parseState === undefined || !ActiveNodeUtils.isPositionInBounds(activeNode)) {
            return undefined;
        }

        return await Inspection.tryNodeScope(
            {
                ...this.inspectionSettings,
                cancellationToken: cancellationTokenOverride ?? this.inspectionSettings.cancellationToken,
                initialCorrelationId: correlationId,
            },
            parseState.contextState.nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            this.typeCache.scopeById,
        );
    }

    protected async inspectScopeType(
        activeNode: TActiveNode,
        correlationId: number,
        cancellationTokenOverride: ICancellationToken | undefined,
    ): Promise<Inspection.TriedScopeType | undefined> {
        const parseState: ParseState | undefined = await this.getParseStateOkOrThrow(undefined);

        if (parseState === undefined || !ActiveNodeUtils.isPositionInBounds(activeNode)) {
            return undefined;
        }

        return await Inspection.tryScopeType(
            {
                ...this.inspectionSettings,
                cancellationToken: cancellationTokenOverride ?? this.inspectionSettings.cancellationToken,
                initialCorrelationId: correlationId,
            },
            parseState.contextState.nodeIdMapCollection,
            ActiveNodeUtils.assertGetLeaf(activeNode).node.id,
            this.typeCache,
        );
    }

    protected async getActiveNodeOkOrThrow(
        position: Position,
        trace: Trace | undefined,
    ): Promise<TActiveNode | undefined> {
        const activeNodeResult: Result<TActiveNode | undefined, CommonError.CommonError> = await this.getActiveNode(
            position,
        );

        if (ResultUtils.isError(activeNodeResult)) {
            trace?.exit({ [TraceConstant.IsThrowing]: true });

            throw activeNodeResult.error;
        }

        return activeNodeResult.value;
    }

    protected async getParseErrorOkOrThrow(trace: Trace | undefined): Promise<ParseError.ParseError | undefined> {
        const parseErrorResult: Result<ParseError.ParseError | undefined, CommonError.CommonError> =
            await this.getParseError();

        if (ResultUtils.isError(parseErrorResult)) {
            trace?.exit({ [TraceConstant.IsThrowing]: true });

            throw parseErrorResult.error;
        }

        return parseErrorResult.value;
    }

    protected async getParseStateOkOrThrow(trace: Trace | undefined): Promise<ParseState | undefined> {
        const parseStateResult: Result<ParseState | undefined, CommonError.CommonError> = await this.getParseState();

        if (ResultUtils.isError(parseStateResult)) {
            trace?.exit({ [TraceConstant.IsThrowing]: true });

            throw parseStateResult.error;
        }

        return parseStateResult.value;
    }

    protected applyAnalysisSettings(analysisSettings: AnalysisSettings): void {
        this.initialCorrelationId = analysisSettings.initialCorrelationId;
        this.inspectionSettings = analysisSettings.inspectionSettings;
        this.locale = analysisSettings.inspectionSettings.locale;
        this.traceManager = analysisSettings.traceManager;
    }
}

function addIdentifierPairedExpressionSymbols(
    nodeIdMapCollection: NodeIdMap.Collection,
    currentSymbols: DocumentSymbol[],
    parentSymbolById: Map<number, DocumentSymbol>,
    cancellationToken: ICancellationToken | undefined,
): void {
    const identifierPairedExpressionIds: Set<number> =
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierPairedExpression) ?? new Set();

    for (const nodeId of identifierPairedExpressionIds) {
        cancellationToken?.throwIfCancelled();

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
    cancellationToken: ICancellationToken | undefined,
): void {
    const recordIdCollections: ReadonlyArray<Set<number>> = [
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordExpression) ?? new Set(),
        nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.RecordLiteral) ?? new Set(),
    ];

    for (const collection of recordIdCollections) {
        for (const nodeId of collection) {
            cancellationToken?.throwIfCancelled();

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
