// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    ParseState,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, AstUtils, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { CommonError, MapUtils, ResultUtils } from "@microsoft/powerquery-parser";
import {
    Hover,
    Location,
    MarkupKind,
    SemanticTokenModifiers,
    SemanticTokenTypes,
    SignatureHelp,
} from "vscode-languageserver-types";
import { DocumentUri } from "vscode-languageserver-textdocument";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import * as InspectionUtils from "../inspectionUtils";
import {
    AutocompleteItemProviderContext,
    IDefinitionProvider,
    ISemanticTokenProvider,
    ISymbolProvider,
    OnIdentifierProviderContext,
    PartialSemanticToken,
    ProviderContext,
    SignatureProviderContext,
} from "./commonTypes";
import { Inspection, Library, PositionUtils } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { ProviderTraceConstant } from "../trace";
import { ScopeUtils } from "../inspection";

export class LocalDocumentProvider implements IDefinitionProvider, ISemanticTokenProvider, ISymbolProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;

    constructor(
        library: Library.ILibrary,
        private readonly uri: DocumentUri,
        private readonly promiseMaybeInspected: Promise<Inspection.Inspected | undefined>,
        private readonly createInspectionSettingsFn: () => InspectionSettings,
    ) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
    }

    public async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getAutocompleteItems.name,
            context.maybeInitialCorrelationId,
        );

        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            trace.exit({ maybeInspectedUndefined: true });

            return [];
        }

        const result: ReadonlyArray<Inspection.AutocompleteItem> = [
            ...this.getAutocompleteItemsFromFieldAccess(maybeInspected),
            ...(await InspectionUtils.getAutocompleteItemsFromScope(context, maybeInspected)),
        ];

        trace.exit();

        return result;
    }

    public async getDefinition(context: OnIdentifierProviderContext): Promise<Location[] | null> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getDefinition.name,
            context.maybeInitialCorrelationId,
        );

        if (
            context.identifier.kind === Ast.NodeKind.GeneralizedIdentifier ||
            context.identifier.identifierContextKind !== Ast.IdentifierContextKind.Value
        ) {
            return null;
        }

        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            return null;
        }

        const triedNodeScope: Inspection.TriedNodeScope = await maybeInspected.triedNodeScope;

        if (ResultUtils.isError(triedNodeScope)) {
            return null;
        }

        const maybeScopeItem: Inspection.TScopeItem | undefined = triedNodeScope.value.get(context.identifier.literal);

        if (maybeScopeItem === undefined) {
            return null;
        }

        const creator: Ast.GeneralizedIdentifier | Ast.Identifier | undefined =
            ScopeUtils.maybeScopeCreatorIdentifier(maybeScopeItem);

        if (creator === undefined) {
            return null;
        }

        const result: Location = {
            range: PositionUtils.createRangeFromTokenRange(creator.tokenRange),
            uri: this.uri,
        };

        trace.exit();

        return [result];
    }

    public async getHover(context: OnIdentifierProviderContext): Promise<Hover | null> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getHover.name,
            context.maybeInitialCorrelationId,
        );

        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            trace.exit({ maybeInspectedUndefined: true });

            return null;
        }

        const activeNode: Inspection.TMaybeActiveNode = maybeInspected.maybeActiveNode;

        if (!Inspection.ActiveNodeUtils.isPositionInBounds(activeNode)) {
            trace.exit({ outOfBounds: true });

            return null;
        }

        let maybeHover: Hover | undefined = await LocalDocumentProvider.getHoverForIdentifierPairedExpression(
            context,
            this.createInspectionSettingsFn(),
            maybeInspected,
            activeNode,
            trace.id,
        );

        if (maybeHover !== undefined) {
            trace.exit({ maybeHover: true });

            return maybeHover;
        }

        const triedNodeScope: Inspection.TriedNodeScope = await maybeInspected.triedNodeScope;
        const triedScopeType: Inspection.TriedScopeType = await maybeInspected.triedScopeType;

        if (!ResultUtils.isOk(triedNodeScope) || !ResultUtils.isOk(triedScopeType)) {
            trace.exit({ inspectionError: true });

            return null;
        }

        maybeHover = LocalDocumentProvider.getHoverForScopeItem(
            context,
            triedNodeScope.value,
            triedScopeType.value,
            trace.id,
        );

        trace.exit();

        return maybeHover ?? null;
    }

    // eslint-disable-next-line require-await
    public async getPartialSemanticTokens(context: ProviderContext): Promise<PartialSemanticToken[]> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getPartialSemanticTokens.name,
            context.maybeInitialCorrelationId,
        );

        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            return [];
        }

        const tokens: PartialSemanticToken[] = [];
        const nodeIdMapCollection: NodeIdMap.Collection = maybeInspected.parseState.contextState.nodeIdMapCollection;

        for (const asNullablePrimitiveTypeId of nodeIdMapCollection.idsByNodeKind.get(
            Ast.NodeKind.AsNullablePrimitiveType,
        ) ?? []) {
            const maybeAsNullablePrimitiveTypeId: Ast.AsNullablePrimitiveType | undefined =
                nodeIdMapCollection.astNodeById.get(asNullablePrimitiveTypeId) as
                    | Ast.AsNullablePrimitiveType
                    | undefined;

            if (maybeAsNullablePrimitiveTypeId === undefined) {
                continue;
            }

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(maybeAsNullablePrimitiveTypeId.paired.tokenRange),
                tokenModifiers: [],
                tokenType: SemanticTokenTypes.type,
            });
        }

        for (const asTypeId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.AsType) ?? []) {
            const maybeAsType: Ast.AsType | undefined = nodeIdMapCollection.astNodeById.get(asTypeId) as
                | Ast.AsType
                | undefined;

            if (maybeAsType === undefined) {
                continue;
            }

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(maybeAsType.paired.tokenRange),
                tokenModifiers: [],
                tokenType: SemanticTokenTypes.type,
            });
        }

        const binOpExprNodeKinds: ReadonlyArray<Ast.NodeKind> = [
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.AsExpression,
            Ast.NodeKind.EqualityExpression,
            Ast.NodeKind.IsExpression,
            Ast.NodeKind.LogicalExpression,
            Ast.NodeKind.MetadataExpression,
            Ast.NodeKind.NullCoalescingExpression,
            Ast.NodeKind.RelationalExpression,
        ];

        const binOpExprNodeIds: number[] = [];

        for (const nodeKind of binOpExprNodeKinds) {
            const maybeNodeIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(nodeKind);

            if (maybeNodeIds?.size) {
                binOpExprNodeIds.push(...maybeNodeIds.values());
            }
        }

        for (const binOpExprId of binOpExprNodeIds) {
            const maybeBinOpExpression: Ast.TNode = MapUtils.assertGet(nodeIdMapCollection.astNodeById, binOpExprId);

            if (!AstUtils.isTBinOpExpression(maybeBinOpExpression)) {
                throw new CommonError.InvariantError(`received a non TBinOpExpression`, { binOpExprId });
            }

            const binOpExpr: Ast.TBinOpExpression = maybeBinOpExpression;

            const tokenType: SemanticTokenTypes = [
                Ast.NodeKind.AsExpression,
                Ast.NodeKind.IsExpression,
                Ast.NodeKind.MetadataExpression,
            ].includes(binOpExpr.kind)
                ? SemanticTokenTypes.keyword
                : SemanticTokenTypes.operator;

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(binOpExpr.operatorConstant.tokenRange),
                tokenModifiers: [],
                tokenType,
            });
        }

        for (const literalId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.LiteralExpression) ?? []) {
            const literal: Ast.LiteralExpression = nodeIdMapCollection.astNodeById.get(
                literalId,
            ) as Ast.LiteralExpression;

            let maybeTokenType: SemanticTokenTypes | undefined;

            switch (literal.literalKind) {
                case Ast.LiteralKind.Numeric:
                    maybeTokenType = SemanticTokenTypes.number;
                    break;

                case Ast.LiteralKind.Text:
                    maybeTokenType = SemanticTokenTypes.string;
                    break;

                default:
                    continue;
            }

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(literal.tokenRange),
                tokenModifiers: [],
                tokenType: maybeTokenType,
            });
        }

        for (const identifierId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.IdentifierExpression) ?? []) {
            const identifierExpr: Ast.IdentifierExpression = nodeIdMapCollection.astNodeById.get(
                identifierId,
            ) as Ast.IdentifierExpression;

            let maybeTokenType: SemanticTokenTypes | undefined;
            let maybeTokenModifiers: SemanticTokenModifiers[] = [];

            switch (identifierExpr.identifier.identifierContextKind) {
                case Ast.IdentifierContextKind.Key:
                    maybeTokenType = SemanticTokenTypes.property;
                    maybeTokenModifiers = [SemanticTokenModifiers.declaration];
                    break;

                case Ast.IdentifierContextKind.Parameter:
                    maybeTokenType = SemanticTokenTypes.parameter;
                    break;

                case Ast.IdentifierContextKind.Value:
                    maybeTokenType = SemanticTokenTypes.variable;

                    if (this.libraryDefinitions.has(identifierExpr.identifier.literal)) {
                        maybeTokenModifiers = [SemanticTokenModifiers.defaultLibrary];
                    }

                    break;

                default:
                    continue;
            }

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(identifierExpr.tokenRange),
                tokenModifiers: maybeTokenModifiers,
                tokenType: maybeTokenType,
            });
        }

        for (const parameterId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Parameter) ?? []) {
            const maybeParameter: Ast.TParameter | undefined = nodeIdMapCollection.astNodeById.get(parameterId) as
                | Ast.TParameter
                | undefined;

            if (maybeParameter === undefined) {
                continue;
            }

            tokens.push({
                range: PositionUtils.createRangeFromTokenRange(maybeParameter.name.tokenRange),
                tokenModifiers: [],
                tokenType: SemanticTokenTypes.parameter,
            });
        }

        trace.exit();

        return tokens;
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getSignatureHelp.name,
            context.maybeInitialCorrelationId,
        );

        const maybeInvokeInspection: Inspection.InvokeExpression | undefined =
            await this.getMaybeInspectionInvokeExpression();

        if (maybeInvokeInspection === undefined) {
            trace.exit({ maybeInvokeInspectionUndefined: true });

            return null;
        }

        const inspection: Inspection.InvokeExpression = maybeInvokeInspection;

        if (inspection.maybeName && !inspection.isNameInLocalScope) {
            trace.exit({ unknownName: true });

            return null;
        }

        const result: SignatureHelp | null = InspectionUtils.getMaybeSignatureHelp(context, trace.id);
        trace.exit();

        return result;
    }

    // When hovering over a key it should show the type for the value.
    // Covers:
    //  * GeneralizedIdentifierPairedAnyLiteral
    //  * GeneralizedIdentifierPairedExpression
    //  * IdentifierPairedExpression
    protected static async getHoverForIdentifierPairedExpression(
        context: OnIdentifierProviderContext,
        inspectionSettings: InspectionSettings,
        inspected: Inspection.Inspected,
        activeNode: Inspection.ActiveNode,
        correlationId: number,
    ): Promise<Hover | undefined> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getHoverForIdentifierPairedExpression.name,
            correlationId,
        );

        const parseState: ParseState = inspected.parseState;
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        const maybeLeafKind: Ast.NodeKind | undefined = ancestry[0]?.node.kind;

        const isValidLeafNodeKind: boolean = [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier].includes(
            maybeLeafKind,
        );

        if (!isValidLeafNodeKind) {
            trace.exit();

            return undefined;
        }

        const maybeIdentifierPairedExpression: TXorNode | undefined = AncestryUtils.maybeNthXorChecked<
            | Ast.GeneralizedIdentifierPairedAnyLiteral
            | Ast.GeneralizedIdentifierPairedExpression
            | Ast.IdentifierPairedExpression
        >(activeNode.ancestry, 1, [
            Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            Ast.NodeKind.IdentifierPairedExpression,
        ]);

        // We're on an identifier in some other context which we don't support.
        if (maybeIdentifierPairedExpression === undefined) {
            trace.exit();

            return undefined;
        }

        const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
            parseState.contextState.nodeIdMapCollection,
            maybeIdentifierPairedExpression.node.id,
            2,
        );

        // We're on an identifier in some other context which we don't support.
        if (maybeExpression === undefined) {
            trace.exit();

            return undefined;
        }

        const triedExpressionType: Inspection.TriedType = await Inspection.tryType(
            inspectionSettings,
            parseState.contextState.nodeIdMapCollection,
            maybeExpression.node.id,
            inspected.typeCache,
        );

        // TODO handle error
        if (ResultUtils.isError(triedExpressionType)) {
            trace.exit();

            return undefined;
        }

        let scopeItemText: string = "unknown";
        // If it's a SectionMember
        const maybeThirdNodeKind: Ast.NodeKind = ancestry[2]?.node.kind;

        if (maybeThirdNodeKind === Ast.NodeKind.SectionMember) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.SectionMember);
        }

        // Else if it's RecordExpression or RecordLiteral
        const maybeFifthNodeKind: Ast.NodeKind = ancestry[4]?.node.kind;

        const isRecordNodeKind: boolean = [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral].includes(
            maybeFifthNodeKind,
        );

        if (isRecordNodeKind) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.RecordField);
        } else if (maybeFifthNodeKind === Ast.NodeKind.LetExpression) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.LetVariable);
        }

        const nameOfExpressionType: string = TypeUtils.nameOf(
            triedExpressionType.value,
            context.traceManager,
            trace.id,
        );

        const result: Hover = {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${scopeItemText}] ${context.identifier.literal}: ${nameOfExpressionType}`,
            },
            range: undefined,
        };

        trace.exit();

        return result;
    }

    protected static getHoverForScopeItem(
        context: OnIdentifierProviderContext,
        nodeScope: Inspection.NodeScope,
        scopeType: Inspection.ScopeTypeByKey,
        correlationId: number,
    ): Hover | undefined {
        const identifierLiteral: string = context.identifier.literal;
        const maybeScopeItem: Inspection.TScopeItem | undefined = nodeScope.get(identifierLiteral);

        if (maybeScopeItem === undefined || maybeScopeItem.kind === Inspection.ScopeItemKind.Undefined) {
            return undefined;
        }

        const scopeItemText: string = InspectionUtils.getScopeItemKindText(maybeScopeItem.kind);

        const maybeScopeItemType: Type.TPowerQueryType | undefined = scopeType.get(identifierLiteral);

        const scopeItemTypeText: string =
            maybeScopeItemType !== undefined
                ? TypeUtils.nameOf(maybeScopeItemType, context.traceManager, correlationId)
                : "unknown";

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${scopeItemText}] ${identifierLiteral}: ${scopeItemTypeText}`,
            },
            range: undefined,
        };
    }

    private async getMaybeInspectionInvokeExpression(): Promise<Inspection.InvokeExpression | undefined> {
        const maybeInspected: Inspection.Inspected | undefined = await this.promiseMaybeInspected;

        if (maybeInspected === undefined) {
            return undefined;
        }

        const triedCurrentInvokeExpression: Inspection.TriedCurrentInvokeExpression =
            await maybeInspected.triedCurrentInvokeExpression;

        return ResultUtils.isOk(triedCurrentInvokeExpression) ? triedCurrentInvokeExpression.value : undefined;
    }

    private getAutocompleteItemsFromFieldAccess(
        inspection: Inspection.Inspected,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        const triedFieldAccess: Inspection.TriedAutocompleteFieldAccess = inspection.autocomplete.triedFieldAccess;

        return ResultUtils.isOk(triedFieldAccess) && triedFieldAccess.value !== undefined
            ? triedFieldAccess.value.autocompleteItems
            : [];
    }
}
