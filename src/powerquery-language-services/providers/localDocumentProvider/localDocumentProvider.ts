// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMap,
    NodeIdMapUtils,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { DocumentUri, FoldingRange, Hover, Location, MarkupKind, SignatureHelp } from "vscode-languageserver-types";
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
import { createFoldingRanges } from "./foldingRanges";
import { createPartialSemanticTokens } from "./partialSemanticToken";
import { ILibrary } from "../../library/library";
import { ProviderTraceConstant } from "../../trace";
import { ScopeUtils } from "../../inspection";

export class LocalDocumentProvider implements ILocalDocumentProvider {
    constructor(
        private readonly uri: DocumentUri,
        private readonly typeCache: Inspection.TypeCache,
        private readonly library: ILibrary,
    ) {}

    public getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getAutocompleteItems.name,
            context.maybeInitialCorrelationId,
        );

        const autocompleteItems: Inspection.AutocompleteItem[] = [
            ...this.getAutocompleteItemsFromFieldAccess(context.autocomplete),
        ].concat(InspectionUtils.getAutocompleteItemsFromScope(context));

        trace.exit();

        return Promise.resolve(ResultUtils.boxOk(autocompleteItems));
    }

    public getDefinition(
        context: DefinitionProviderContext,
    ): Promise<Result<Location[] | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getDefinition.name,
            context.maybeInitialCorrelationId,
        );

        if (
            context.identifier.kind === Ast.NodeKind.GeneralizedIdentifier ||
            context.identifier.identifierContextKind !== Ast.IdentifierContextKind.Value
        ) {
            return Promise.resolve(ResultUtils.boxOk(undefined));
        }

        const triedNodeScope: Inspection.TriedNodeScope = context.triedNodeScope;

        if (ResultUtils.isError(triedNodeScope)) {
            return Promise.resolve(ResultUtils.boxOk(undefined));
        }

        const maybeScopeItem: Inspection.TScopeItem | undefined = triedNodeScope.value.get(context.identifier.literal);

        if (maybeScopeItem === undefined) {
            return Promise.resolve(ResultUtils.boxOk(undefined));
        }

        const creator: Ast.GeneralizedIdentifier | Ast.Identifier | undefined =
            ScopeUtils.maybeScopeCreatorIdentifier(maybeScopeItem);

        if (creator === undefined) {
            return Promise.resolve(ResultUtils.boxOk(undefined));
        }

        const location: Location = {
            range: PositionUtils.createRangeFromTokenRange(creator.tokenRange),
            uri: this.uri,
        };

        trace.exit();

        return Promise.resolve(ResultUtils.boxOk([location]));
    }

    public getFoldingRanges(
        context: FoldingRangeProviderContext,
    ): Promise<Result<FoldingRange[], CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getFoldingRanges.name,
            context.maybeInitialCorrelationId,
        );

        const foldingRanges: FoldingRange[] = createFoldingRanges(
            context.nodeIdMapCollection,
            context.traceManager,
            trace.id,
        );

        trace.exit();

        return Promise.resolve(ResultUtils.boxOk(foldingRanges));
    }

    public async getHover(context: HoverProviderContext): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getHover.name,
            context.maybeInitialCorrelationId,
        );

        let maybeHover: Hover | undefined = await this.getHoverForIdentifierPairedExpression(context, trace.id);

        if (maybeHover !== undefined) {
            trace.exit({ maybeHover: true });

            return ResultUtils.boxOk(maybeHover);
        }

        const triedNodeScope: Inspection.TriedNodeScope = context.triedNodeScope;
        const triedScopeType: Inspection.TriedScopeType = context.triedScopeType;

        if (!ResultUtils.isOk(triedNodeScope) || !ResultUtils.isOk(triedScopeType)) {
            trace.exit({ inspectionError: true });

            return ResultUtils.boxOk(undefined);
        }

        maybeHover = this.getHoverForScopeItem(context, triedNodeScope.value, triedScopeType.value, trace.id);

        trace.exit();

        return ResultUtils.boxOk(maybeHover ?? undefined);
    }

    // eslint-disable-next-line require-await
    public async getPartialSemanticTokens(
        context: SemanticTokenProviderContext,
    ): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getPartialSemanticTokens.name,
            context.maybeInitialCorrelationId,
        );

        const nodeIdMapCollection: NodeIdMap.Collection = context.parseState.contextState.nodeIdMapCollection;

        const tokens: PartialSemanticToken[] = createPartialSemanticTokens(
            nodeIdMapCollection,
            this.library.libraryDefinitions,
            context.traceManager,
            trace.id,
        );

        trace.exit();

        return ResultUtils.boxOk(tokens);
    }

    // eslint-disable-next-line require-await
    public async getSignatureHelp(
        context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getSignatureHelp.name,
            context.maybeInitialCorrelationId,
        );

        const maybeInvokeInspection: Inspection.InvokeExpression | undefined = ResultUtils.isOk(
            context.triedCurrentInvokeExpression,
        )
            ? context.triedCurrentInvokeExpression.value
            : undefined;

        if (maybeInvokeInspection === undefined) {
            trace.exit({ maybeInvokeInspectionUndefined: true });

            return ResultUtils.boxOk(undefined);
        }

        if (maybeInvokeInspection.maybeName && !maybeInvokeInspection.isNameInLocalScope) {
            trace.exit({ unknownName: true });

            return ResultUtils.boxOk(undefined);
        }

        const identifierLiteral: string | undefined = context.functionName;

        if (identifierLiteral === undefined || !TypeUtils.isDefinedFunction(context.functionType)) {
            return ResultUtils.boxOk(undefined);
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

        return ResultUtils.boxOk(result);
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

        const ancestry: ReadonlyArray<TXorNode> = context.activeNode.ancestry;
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
        >(context.activeNode.ancestry, 1, [
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
            context.parseState.contextState.nodeIdMapCollection,
            maybeIdentifierPairedExpression.node.id,
            2,
        );

        // We're on an identifier in some other context which we don't support.
        if (maybeExpression === undefined) {
            trace.exit();

            return undefined;
        }

        const triedExpressionType: Inspection.TriedType = await Inspection.tryType(
            {
                ...context.inspectionSettings,
                maybeInitialCorrelationId: trace.id,
            },
            context.parseState.contextState.nodeIdMapCollection,
            maybeExpression.node.id,
            this.typeCache,
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

    protected getHoverForScopeItem(
        context: HoverProviderContext,
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

    private getAutocompleteItemsFromFieldAccess(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        const triedFieldAccess: Inspection.TriedAutocompleteFieldAccess = autocomplete.triedFieldAccess;

        return ResultUtils.isOk(triedFieldAccess) && triedFieldAccess.value !== undefined
            ? triedFieldAccess.value.autocompleteItems
            : [];
    }
}
