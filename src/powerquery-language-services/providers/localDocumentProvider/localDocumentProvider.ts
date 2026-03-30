// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapIterator,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import {
    Ast,
    IdentifierExpressionUtils,
    IdentifierUtils,
    Type,
    TypeUtils,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import {
    CompletionItemKind,
    DocumentUri,
    FoldingRange,
    Hover,
    Location,
    MarkupKind,
    SignatureHelp,
    TextEdit,
} from "vscode-languageserver-types";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import * as InspectionUtils from "../../inspectionUtils";
import {
    AutocompleteItemProviderContext,
    DefinitionProviderContext,
    FoldingRangeProviderContext,
    HoverProviderContext,
    ILocalDocumentProvider,
    PartialSemanticToken,
    SemanticTokenProviderContext,
    SignatureProviderContext,
} from "../commonTypes";
import { Inspection, PositionUtils } from "../..";
import { InspectionSettings, normalizeInspectionSettingsForParser, TypeStrategy } from "../../inspectionSettings";
import { calculateJaroWinkler } from "../../jaroWinkler";
import { createFoldingRanges } from "./foldingRanges";
import { createPartialSemanticTokens } from "./partialSemanticToken";
import { ExternalTypeUtils } from "../../externalType";
import { ILibrary } from "../../library/library";
import { ProviderTraceConstant } from "../../trace";
import { ScopeUtils } from "../../inspection";

const AllowedExtendedTypeKindsForRecordFieldSuggestions: ReadonlyArray<Type.ExtendedTypeKind> = [
    Type.ExtendedTypeKind.AnyUnion,
    Type.ExtendedTypeKind.DefinedRecord,
    Type.ExtendedTypeKind.DefinedTable,
    Type.ExtendedTypeKind.RecordType,
];

export class LocalDocumentProvider implements ILocalDocumentProvider {
    private readonly uri: DocumentUri;
    private readonly typeCache: Inspection.TypeCache;
    private readonly library: ILibrary;
    protected readonly locale: string;

    constructor(uri: DocumentUri, typeCache: Inspection.TypeCache, library: ILibrary, locale: string) {
        this.uri = uri;
        this.typeCache = typeCache;
        this.library = library;
        this.locale = locale;
    }

    public getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LocalDocumentSymbolProvider,
                this.getAutocompleteItems.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            const autocompleteItems: Inspection.AutocompleteItem[] = [
                ...this.getAutocompleteItemsFromFieldAccess(context.autocomplete),
                ...(await this.getAutocompleteItemsFromCurrentRecord(context)),
            ].concat(await InspectionUtils.getAutocompleteItemsFromScope(context));

            trace.exit();

            return autocompleteItems;
        }, this.locale);
    }

    public getDefinition(
        context: DefinitionProviderContext,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        // eslint-disable-next-line require-await
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LocalDocumentSymbolProvider,
                this.getDefinition.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            if (
                context.identifier.kind === Ast.NodeKind.GeneralizedIdentifier ||
                context.identifier.identifierContextKind !== Ast.IdentifierContextKind.Value
            ) {
                return undefined;
            }

            const triedNodeScope: Inspection.TriedNodeScope = context.triedNodeScope;

            if (ResultUtils.isError(triedNodeScope)) {
                return undefined;
            }

            const scopeItem: Inspection.TScopeItem | undefined = triedNodeScope.value.scopeItemByKey.get(
                context.identifier.literal,
            );

            if (scopeItem === undefined) {
                return undefined;
            }

            const creator: Ast.GeneralizedIdentifier | Ast.Identifier | undefined =
                ScopeUtils.scopeCreatorIdentifier(scopeItem);

            if (creator === undefined) {
                return undefined;
            }

            const location: Location = {
                range: PositionUtils.rangeFromTokenRange(creator.tokenRange),
                uri: this.uri,
            };

            trace.exit();

            return [location];
        }, this.locale);
    }

    public getFoldingRanges(
        context: FoldingRangeProviderContext,
    ): Promise<Result<FoldingRange[], CommonError.CommonError>> {
        // eslint-disable-next-line require-await
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LocalDocumentSymbolProvider,
                this.getFoldingRanges.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            const foldingRanges: FoldingRange[] = createFoldingRanges(
                context.nodeIdMapCollection,
                context.traceManager,
                trace.id,
            );

            trace.exit();

            return foldingRanges;
        }, this.locale);
    }

    public getHover(context: HoverProviderContext): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LocalDocumentSymbolProvider,
                this.getHover.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            let hover: Hover | undefined = await this.getHoverForIdentifierPairedExpression(context, trace.id);

            if (hover !== undefined) {
                trace.exit({ hover: true });

                return hover;
            }

            const triedNodeScope: Inspection.TriedNodeScope = context.triedNodeScope;
            const triedScopeType: Inspection.TriedScopeType = context.triedScopeType;

            if (!ResultUtils.isOk(triedNodeScope) || !ResultUtils.isOk(triedScopeType)) {
                trace.exit({ inspectionError: true });

                return undefined;
            }

            hover = await this.getHoverForScopeItem(context, triedNodeScope.value, triedScopeType.value, trace.id);

            trace.exit();

            return hover ?? undefined;
        }, this.locale);
    }

    // eslint-disable-next-line require-await
    public async getPartialSemanticTokens(
        context: SemanticTokenProviderContext,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResult(() => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LocalDocumentSymbolProvider,
                this.getPartialSemanticTokens.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            const nodeIdMapCollection: NodeIdMap.Collection = context.parseState.contextState.nodeIdMapCollection;

            const tokens: PartialSemanticToken[] = createPartialSemanticTokens(
                nodeIdMapCollection,
                this.library.libraryDefinitions,
                context.traceManager,
                trace.id,
                context.cancellationToken,
            );

            trace.exit();

            return tokens;
        }, this.locale);
    }

    // eslint-disable-next-line require-await
    public async getSignatureHelp(
        context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        return ResultUtils.ensureResult(() => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LocalDocumentSymbolProvider,
                this.getSignatureHelp.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            const invokeInspection: Inspection.InvokeExpression | undefined = ResultUtils.isOk(
                context.triedCurrentInvokeExpression,
            )
                ? context.triedCurrentInvokeExpression.value
                : undefined;

            if (invokeInspection === undefined) {
                trace.exit({ invokeInspectionUndefined: true });

                return undefined;
            }

            if (invokeInspection.name && !invokeInspection.isNameInLocalScope) {
                trace.exit({ unknownName: true });

                return undefined;
            }

            const identifierLiteral: string | undefined = context.functionName;

            if (identifierLiteral === undefined || !TypeUtils.isFunctionSignature(context.functionType)) {
                return undefined;
            }

            const nameOfParameters: string = context.functionType.parameters
                .map((parameter: Type.FunctionParameter) =>
                    TypeUtils.nameOfFunctionParameter(parameter, context.traceManager, trace.id),
                )
                .join(", ");

            const label: string = `${identifierLiteral}(${nameOfParameters})`;

            const parameters: ReadonlyArray<Type.FunctionParameter> = context.functionType.parameters;

            const result: SignatureHelp = {
                activeParameter: context.argumentOrdinal,
                activeSignature: 0,
                signatures: [
                    {
                        label,
                        parameters: parameters.map((parameter: Type.FunctionParameter) => ({
                            label: parameter.nameLiteral,
                        })),
                    },
                ],
            };

            trace.exit();

            return result;
        }, this.locale);
    }

    // When hovering over a key it should show the type for the value.
    // Covers:
    //  * GeneralizedIdentifierPairedAnyLiteral
    //  * GeneralizedIdentifierPairedExpression
    //  * IdentifierPairedExpression
    protected async getHoverForIdentifierPairedExpression(
        context: HoverProviderContext,
        correlationId: number,
    ): Promise<Hover | undefined> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getHoverForIdentifierPairedExpression.name,
            correlationId,
        );

        context.cancellationToken?.throwIfCancelled();

        const ancestry: ReadonlyArray<TXorNode> = context.activeNode.ancestry;
        const leafKInd: Ast.NodeKind | undefined = ancestry[0]?.node.kind;

        const isValidLeafNodeKind: boolean = [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier].includes(
            leafKInd,
        );

        if (!isValidLeafNodeKind) {
            trace.exit();

            return undefined;
        }

        const identifierPairedExpression: TXorNode | undefined = AncestryUtils.nthChecked<
            | Ast.GeneralizedIdentifierPairedAnyLiteral
            | Ast.GeneralizedIdentifierPairedExpression
            | Ast.IdentifierPairedExpression
        >(context.activeNode.ancestry, 1, [
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.IdentifierPairedExpression,
        ]);

        // We're on an identifier in some other context which we don't support.
        if (identifierPairedExpression === undefined) {
            trace.exit();

            return undefined;
        }

        const expression: TXorNode | undefined = NodeIdMapUtils.nthChildXor(
            context.parseState.contextState.nodeIdMapCollection,
            identifierPairedExpression.node.id,
            2,
        );

        // We're on an identifier in some other context which we don't support.
        if (expression === undefined) {
            trace.exit();

            return undefined;
        }

        const triedExpressionType: Inspection.TriedType = await Inspection.tryType(
            {
                ...context.inspectionSettings,
                initialCorrelationId: trace.id,
            },
            context.parseState.contextState.nodeIdMapCollection,
            expression.node.id,
            this.typeCache,
        );

        // TODO handle error
        if (ResultUtils.isError(triedExpressionType)) {
            trace.exit();

            return undefined;
        }

        let scopeItemText: string = "unknown";
        // If it's a SectionMember
        const thirdNodeKind: Ast.NodeKind = ancestry[2]?.node.kind;

        if (thirdNodeKind === Ast.NodeKind.SectionMember) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.SectionMember);
        }

        // Else if it's RecordExpression or RecordLiteral
        const fifthNodeKind: Ast.NodeKind = ancestry[4]?.node.kind;

        const isRecordNodeKind: boolean = [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral].includes(
            fifthNodeKind,
        );

        if (isRecordNodeKind) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.RecordField);
        } else if (fifthNodeKind === Ast.NodeKind.LetExpression) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.LetVariable);
        }

        const scopeItem: Inspection.TScopeItem | undefined = ResultUtils.isOk(context.triedNodeScope)
            ? context.triedNodeScope.value.scopeItemByKey.get(context.identifier.literal)
            : undefined;

        const scopedType: Type.TPowerQueryType | undefined = ResultUtils.isOk(context.triedScopeType)
            ? await context.triedScopeType.value.resolveType(context.identifier.literal)
            : undefined;

        const sectionMember: TXorNode | undefined = AncestryUtils.nthChecked<Ast.SectionMember>(
            context.activeNode.ancestry,
            2,
            Ast.NodeKind.SectionMember,
        );

        const sectionMemberNode: Ast.SectionMember | undefined =
            sectionMember?.node.kind === Ast.NodeKind.SectionMember
                ? (sectionMember.node as Ast.SectionMember)
                : undefined;

        const currentNodeTypeDirective: string | undefined = sectionMemberNode?.precedingDirectives
            ?.find((directive: { kind: string }) => directive.kind === "Type")
            ?.value?.trim();

        let nameOfExpressionType: string;

        if (scopedType !== undefined) {
            nameOfExpressionType = TypeUtils.nameOf(scopedType, context.traceManager, trace.id);
        } else if (currentNodeTypeDirective !== undefined) {
            nameOfExpressionType = this.directiveHoverTypeText(currentNodeTypeDirective);
        } else {
            nameOfExpressionType = TypeUtils.nameOf(triedExpressionType.value, context.traceManager, trace.id);
        }

        const result: Hover = {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: this.createScopeItemHoverValue(
                    scopeItemText,
                    context.identifier.literal,
                    nameOfExpressionType,
                    this.hasTypeDirective(
                        scopeItem,
                        Boolean(sectionMemberNode?.precedingDirectives?.length),
                        context.inspectionSettings.isTypeDirectiveAllowed,
                    ),
                ),
            },
            range: undefined,
        };

        trace.exit();

        return result;
    }

    protected async getHoverForScopeItem(
        context: HoverProviderContext,
        nodeScope: Inspection.NodeScope,
        scopeType: Inspection.ScopeTypeByKey,
        correlationId: number,
    ): Promise<Hover | undefined> {
        const identifierLiteral: string = context.identifier.literal;
        const scopeItem: Inspection.TScopeItem | undefined = nodeScope.scopeItemByKey.get(identifierLiteral);

        if (scopeItem === undefined || scopeItem.kind === Inspection.ScopeItemKind.Undefined) {
            return undefined;
        }

        const scopeItemText: string = InspectionUtils.getScopeItemKindText(scopeItem.kind);

        const scopeItemType: Type.TPowerQueryType | undefined = await scopeType.resolveType(identifierLiteral);

        const scopeItemTypeText: string =
            scopeItemType !== undefined
                ? TypeUtils.nameOf(scopeItemType, context.traceManager, correlationId)
                : "unknown";

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: this.createScopeItemHoverValue(
                    scopeItemText,
                    identifierLiteral,
                    scopeItemTypeText,
                    this.hasTypeDirective(scopeItem, false, context.inspectionSettings.isTypeDirectiveAllowed),
                ),
            },
            range: undefined,
        };
    }

    private createScopeItemHoverValue(
        scopeItemText: string,
        identifierLiteral: string,
        scopeItemTypeText: string,
        hasTypeDirective: boolean,
    ): string {
        return `[${scopeItemText}] ${identifierLiteral}: ${scopeItemTypeText}${
            hasTypeDirective ? " (via @type directive)" : ""
        }`;
    }

    private hasTypeDirective(
        scopeItem: Inspection.TScopeItem | undefined,
        hasDirectiveOnCurrentNode: boolean = false,
        isTypeDirectiveAllowed: boolean = false,
    ): boolean {
        if (!isTypeDirectiveAllowed) {
            return false;
        }

        if (
            !ScopeUtils.isLetVariable(scopeItem) &&
            !ScopeUtils.isRecordField(scopeItem) &&
            !ScopeUtils.isSectionMember(scopeItem)
        ) {
            return hasDirectiveOnCurrentNode;
        }

        return hasDirectiveOnCurrentNode || Boolean(scopeItem.typeDirective?.value?.trim());
    }

    private directiveHoverTypeText(payload: string): string {
        const trimmed: string = payload.trim();

        return /^type\b/i.test(trimmed) ? trimmed : `type ${trimmed}`;
    }

    private getAutocompleteItemsFromFieldAccess(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        const triedFieldAccess: Inspection.TriedAutocompleteFieldAccess = autocomplete.triedFieldAccess;

        return ResultUtils.isOk(triedFieldAccess) && triedFieldAccess.value !== undefined
            ? triedFieldAccess.value.autocompleteItems
            : [];
    }

    private async getAutocompleteItemsFromCurrentRecord(
        context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
        if (!context.inspectionSettings.isTypeDirectiveAllowed || ResultUtils.isError(context.triedNodeScope)) {
            return [];
        }

        const scopeTypeByKey: Inspection.ScopeTypeByKey = ResultUtils.isOk(context.triedScopeType)
            ? context.triedScopeType.value
            : Inspection.ScopeTypeByKey.empty();

        const typeDirectiveValue: string | undefined = this.findCurrentRecordTypeDirective(context);

        if (typeDirectiveValue === undefined) {
            return [];
        }

        const currentDeclarationType: Type.TPowerQueryType | undefined = await this.resolveDirectiveType(
            typeDirectiveValue,
            context.inspectionSettings,
            scopeTypeByKey,
            context.initialCorrelationId,
        );

        if (currentDeclarationType === undefined) {
            return [];
        }

        const existingFieldLabels: ReadonlySet<string> = this.findCurrentRecordFieldLabels(context);

        return this.fieldEntriesFromFieldType(currentDeclarationType)
            .filter(([label]: [string, Type.TPowerQueryType]) => !existingFieldLabels.has(label))
            .map(([label, powerQueryType]: [string, Type.TPowerQueryType]) =>
                this.createRecordFieldAutocompleteItem(label, powerQueryType, context),
            );
    }

    private findCurrentRecordTypeDirective(context: AutocompleteItemProviderContext): string | undefined {
        const declarationNode: TXorNode | undefined = this.findCurrentRecordDeclarationNode(context);
        const declarationTypeDirective: string | undefined = this.findTypeDirectiveOnNode(declarationNode?.node);

        if (declarationTypeDirective !== undefined) {
            return declarationTypeDirective;
        }

        const commentTypeDirective: string | undefined = this.findTypeDirectiveInLeadingComments(
            context,
            declarationNode,
        );

        if (commentTypeDirective !== undefined) {
            return commentTypeDirective;
        }

        return this.findCurrentRecordDeclarationScopeItem(context)?.typeDirective?.value;
    }

    private findCurrentRecordDeclarationNodes(context: AutocompleteItemProviderContext): ReadonlyArray<TXorNode> {
        if (
            !Inspection.ActiveNodeUtils.isPositionInBounds(context.activeNode) ||
            ResultUtils.isError(context.triedNodeScope)
        ) {
            return [];
        }

        const ancestry: ReadonlyArray<TXorNode> = context.activeNode.ancestry;

        const recordNodeIndex: number = ancestry.findIndex(
            (xorNode: TXorNode) =>
                xorNode.node.kind === Ast.NodeKind.RecordExpression || xorNode.node.kind === Ast.NodeKind.RecordLiteral,
        );

        if (recordNodeIndex < 0) {
            return [];
        }

        const isInsideExistingRecordPair: boolean = ancestry
            .slice(0, recordNodeIndex)
            .some(
                (xorNode: TXorNode) =>
                    xorNode.node.kind === Ast.NodeKind.IdentifierPairedExpression ||
                    xorNode.node.kind === Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            );

        if (isInsideExistingRecordPair) {
            return [];
        }

        return ancestry
            .slice(recordNodeIndex + 1)
            .filter(
                (xorNode: TXorNode) =>
                    xorNode.node.kind === Ast.NodeKind.IdentifierPairedExpression ||
                    xorNode.node.kind === Ast.NodeKind.GeneralizedIdentifierPairedExpression ||
                    xorNode.node.kind === Ast.NodeKind.SectionMember,
            );
    }

    private findCurrentRecordDeclarationNode(context: AutocompleteItemProviderContext): TXorNode | undefined {
        const declarationNodes: ReadonlyArray<TXorNode> = this.findCurrentRecordDeclarationNodes(context);

        return (
            declarationNodes.find((xorNode: TXorNode) => this.findTypeDirectiveOnNode(xorNode.node) !== undefined) ??
            declarationNodes[0]
        );
    }

    private findCurrentRecordDeclarationScopeItem(
        context: AutocompleteItemProviderContext,
    ): Inspection.TKeyValuePairScopeItem | undefined {
        const declarationNodes: ReadonlyArray<TXorNode> = this.findCurrentRecordDeclarationNodes(context);

        const declarationNode: TXorNode | undefined = declarationNodes.find(
            (xorNode: TXorNode) => this.findTypeDirectiveOnNode(xorNode.node) !== undefined,
        );

        if (declarationNode === undefined || ResultUtils.isError(context.triedNodeScope)) {
            return undefined;
        }

        const declarationNodeIds: Set<number> = new Set(declarationNodes.map((xorNode: TXorNode) => xorNode.node.id));

        declarationNodeIds.add(declarationNode.node.id);

        const nodeScope: Inspection.NodeScope = context.triedNodeScope.value;
        let fallbackScopeItem: Inspection.TKeyValuePairScopeItem | undefined;

        for (const scopeItem of nodeScope.scopeItemByKey.values()) {
            if (
                declarationNodeIds.has(scopeItem.nodeId) &&
                (ScopeUtils.isLetVariable(scopeItem) ||
                    ScopeUtils.isRecordField(scopeItem) ||
                    ScopeUtils.isSectionMember(scopeItem))
            ) {
                if (scopeItem.typeDirective?.value !== undefined) {
                    return scopeItem;
                }

                fallbackScopeItem ??= scopeItem;
            }
        }

        return fallbackScopeItem;
    }

    private findCurrentRecordFieldLabels(context: AutocompleteItemProviderContext): ReadonlySet<string> {
        const recordNode: TXorNode | undefined = this.findCurrentRecordNode(context);

        if (recordNode === undefined) {
            return new Set();
        }

        return new Set(
            NodeIdMapIterator.iterRecord(context.parseState.contextState.nodeIdMapCollection, recordNode).map(
                (keyValuePair: NodeIdMapIterator.RecordKeyValuePair) => keyValuePair.normalizedKeyLiteral,
            ),
        );
    }

    private findCurrentRecordNode(context: AutocompleteItemProviderContext): TXorNode | undefined {
        if (!Inspection.ActiveNodeUtils.isPositionInBounds(context.activeNode)) {
            return undefined;
        }

        return context.activeNode.ancestry.find(
            (xorNode: TXorNode) =>
                xorNode.node.kind === Ast.NodeKind.RecordExpression || xorNode.node.kind === Ast.NodeKind.RecordLiteral,
        );
    }

    private findTypeDirectiveOnNode(node: unknown): string | undefined {
        return (
            node as { precedingDirectives?: ReadonlyArray<{ kind: string; value?: string }> } | undefined
        )?.precedingDirectives
            ?.find((directive: { kind: string }) => directive.kind === "Type")
            ?.value?.trim();
    }

    private findTypeDirectiveInLeadingComments(
        context: AutocompleteItemProviderContext,
        declarationNode: TXorNode | undefined,
    ): string | undefined {
        const declarationLine: number | undefined = (
            declarationNode?.node as { tokenStart?: { positionStart?: { lineNumber?: number } } } | undefined
        )?.tokenStart?.positionStart?.lineNumber;

        if (declarationLine === undefined) {
            return undefined;
        }

        const comments: ReadonlyArray<{
            kind?: string;
            data?: string;
            positionEnd?: { lineNumber?: number };
        }> = context.parseState.lexerSnapshot.comments;

        for (let index: number = comments.length - 1; index >= 0; index -= 1) {
            const comment: (typeof comments)[number] = comments[index];

            if (
                comment.kind === "Line" &&
                comment.positionEnd?.lineNumber === declarationLine - 1 &&
                comment.data?.startsWith("/// @type")
            ) {
                return comment.data.replace(/^\/\/\/\s*@type\s*/i, "").trim();
            }
        }

        return undefined;
    }

    private async resolveDirectiveType(
        payload: string,
        inspectionSettings: InspectionSettings,
        scopeTypeByKey: Inspection.ScopeTypeByKey,
        correlationId: number | undefined,
    ): Promise<Type.TPowerQueryType | undefined> {
        const trimmedPayload: string = payload.trim();

        if (trimmedPayload.length === 0) {
            return undefined;
        }

        const scopeType: Type.TPowerQueryType | undefined = await scopeTypeByKey.resolveType(trimmedPayload);

        if (scopeType !== undefined && this.fieldEntriesFromFieldType(scopeType).length > 0) {
            return scopeType;
        }

        const externalType: Type.TPowerQueryType | undefined = this.tryResolveDirectiveTypeFromLibrary(trimmedPayload);

        if (externalType !== undefined && this.fieldEntriesFromFieldType(externalType).length > 0) {
            return externalType;
        }

        return await this.tryResolveDirectiveTypeFromStandaloneText(trimmedPayload, inspectionSettings, correlationId);
    }

    private tryResolveDirectiveTypeFromLibrary(payload: string): Type.TPowerQueryType | undefined {
        try {
            return this.library.externalTypeResolver(
                ExternalTypeUtils.valueTypeRequest(
                    IdentifierExpressionUtils.assertNormalizedIdentifierExpression(payload),
                ),
            );
        } catch {
            return undefined;
        }
    }

    private async tryResolveDirectiveTypeFromStandaloneText(
        payload: string,
        inspectionSettings: InspectionSettings,
        correlationId: number | undefined,
    ): Promise<Type.TPowerQueryType | undefined> {
        const settings: InspectionSettings = InspectionUtils.inspectionSettings(
            {
                ...inspectionSettings,
                initialCorrelationId: correlationId,
                isTypeDirectiveAllowed: false,
            },
            {
                isWorkspaceCacheAllowed: inspectionSettings.isWorkspaceCacheAllowed,
                library: inspectionSettings.library,
                eachScopeById: inspectionSettings.eachScopeById,
                typeStrategy: TypeStrategy.Extended,
            },
        );

        const triedLexParse: PQP.Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(
            normalizeInspectionSettingsForParser(settings),
            this.normalizeTypeDirectivePayload(payload),
        );

        if (
            PQP.TaskUtils.isLexStageError(triedLexParse) ||
            PQP.TaskUtils.isParseStageError(triedLexParse) ||
            PQP.TaskUtils.isParseStageCommonError(triedLexParse)
        ) {
            return undefined;
        }

        const triedType: Inspection.TriedType = await Inspection.tryType(
            settings,
            triedLexParse.nodeIdMapCollection,
            triedLexParse.ast.id,
        );

        return ResultUtils.isOk(triedType) ? triedType.value : undefined;
    }

    private normalizeTypeDirectivePayload(payload: string): string {
        const trimmed: string = payload.trim();

        if (trimmed.length === 0 || /^type\b/i.test(trimmed) || !this.shouldPrefixTypeKeyword(trimmed)) {
            return trimmed;
        }

        return `type ${trimmed}`;
    }

    private shouldPrefixTypeKeyword(payload: string): boolean {
        if (["[", "{"].includes(payload[0])) {
            return true;
        }

        const leadingToken: string = payload.split(/\s|\(/, 1)[0].toLowerCase();

        return [
            "action",
            "any",
            "anynonnull",
            "binary",
            "date",
            "datetime",
            "datetimezone",
            "duration",
            "function",
            "list",
            "logical",
            "none",
            "null",
            "number",
            "nullable",
            "record",
            "table",
            "text",
            "time",
            "type",
        ].includes(leadingToken);
    }

    private fieldEntriesFromFieldType(type: Type.TPowerQueryType): ReadonlyArray<[string, Type.TPowerQueryType]> {
        if (type.extendedKind === undefined) {
            return [];
        }

        switch (type.extendedKind) {
            case Type.ExtendedTypeKind.AnyUnion: {
                let fields: [string, Type.TPowerQueryType][] = [];

                for (const unionedType of type.unionedTypePairs) {
                    if (
                        unionedType.extendedKind !== undefined &&
                        AllowedExtendedTypeKindsForRecordFieldSuggestions.includes(unionedType.extendedKind)
                    ) {
                        fields = fields.concat(this.fieldEntriesFromFieldType(unionedType));
                    }
                }

                return fields;
            }

            case Type.ExtendedTypeKind.DefinedRecord:
            case Type.ExtendedTypeKind.DefinedTable:
            case Type.ExtendedTypeKind.RecordType:
                return [...type.fields.entries()];

            case Type.ExtendedTypeKind.DefinedFunction:
            case Type.ExtendedTypeKind.DefinedList:
            case Type.ExtendedTypeKind.DefinedListType:
            case Type.ExtendedTypeKind.FunctionType:
            case Type.ExtendedTypeKind.ListType:
            case Type.ExtendedTypeKind.LogicalLiteral:
            case Type.ExtendedTypeKind.NumberLiteral:
            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            case Type.ExtendedTypeKind.TableType:
            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            case Type.ExtendedTypeKind.TextLiteral:
            default:
                return [];
        }
    }

    private createRecordFieldAutocompleteItem(
        label: string,
        powerQueryType: Type.TPowerQueryType,
        context: AutocompleteItemProviderContext,
    ): Inspection.AutocompleteItem {
        const jaroWinklerScore: number = context.text ? calculateJaroWinkler(label, context.text) : 1;

        return {
            jaroWinklerScore,
            kind: CompletionItemKind.Field,
            label: IdentifierUtils.assertNormalizedIdentifier(label, { allowGeneralizedIdentifier: true }),
            powerQueryType,
            textEdit: context.range ? TextEdit.replace(context.range, label) : undefined,
        };
    }
}
