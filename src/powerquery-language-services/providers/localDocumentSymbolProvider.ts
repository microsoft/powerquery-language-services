// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AncestryUtils,
    NodeIdMapUtils,
    ParseState,
    TXorNode,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import * as InspectionUtils from "../inspectionUtils";
import {
    AutocompleteItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";
import { Inspection, Library } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { ProviderTraceConstant } from "../trace";

export class LocalDocumentSymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;

    constructor(
        library: Library.ILibrary,
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

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
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

        let maybeHover: Hover | undefined = await LocalDocumentSymbolProvider.getHoverForIdentifierPairedExpression(
            context,
            this.createInspectionSettingsFn(),
            maybeInspected,
            activeNode,
        );

        if (maybeHover !== undefined) {
            trace.exit({ maybeHoverUndefined: true });

            return maybeHover;
        }

        const triedNodeScope: Inspection.TriedNodeScope = await maybeInspected.triedNodeScope;
        const triedScopeType: Inspection.TriedScopeType = await maybeInspected.triedScopeType;

        if (!ResultUtils.isOk(triedNodeScope) || !ResultUtils.isOk(triedScopeType)) {
            trace.exit({ inspectionError: true });

            return null;
        }

        maybeHover = LocalDocumentSymbolProvider.getHoverForScopeItem(
            context,
            triedNodeScope.value,
            triedScopeType.value,
        );

        trace.exit();

        return maybeHover ?? null;
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LocalDocumentSymbolProvider,
            this.getHover.name,
            context.maybeInitialCorrelationId,
        );

        const maybeInvokeInspection: Inspection.InvokeExpression | undefined =
            await this.getMaybeInspectionInvokeExpression();

        if (maybeInvokeInspection === undefined) {
            trace.exit({ maybeInvokeInspection });

            return null;
        }

        const inspection: Inspection.InvokeExpression = maybeInvokeInspection;

        if (inspection.maybeName && !inspection.isNameInLocalScope) {
            trace.exit();

            return null;
        }

        const result: SignatureHelp | null = InspectionUtils.getMaybeSignatureHelp(context);
        trace.exit();

        return result;
    }

    // When hovering over a key it should show the type for the value.
    // Covers:
    //  * GeneralizedIdentifierPairedAnyLiteral
    //  * GeneralizedIdentifierPairedExpression
    //  * IdentifierPairedExpression
    protected static async getHoverForIdentifierPairedExpression(
        context: HoverProviderContext,
        inspectionSettings: InspectionSettings,
        inspected: Inspection.Inspected,
        activeNode: Inspection.ActiveNode,
    ): Promise<Hover | undefined> {
        const parseState: ParseState = inspected.parseState;
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        const maybeLeafKind: Ast.NodeKind | undefined = ancestry[0]?.node.kind;

        const isValidLeafNodeKind: boolean = [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier].includes(
            maybeLeafKind,
        );

        if (!isValidLeafNodeKind) {
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
            return undefined;
        }

        const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeNthChild(
            parseState.contextState.nodeIdMapCollection,
            maybeIdentifierPairedExpression.node.id,
            2,
        );

        // We're on an identifier in some other context which we don't support.
        if (maybeExpression === undefined) {
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

        const nameOfExpressionType: string = TypeUtils.nameOf(triedExpressionType.value);

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${scopeItemText}] ${context.identifier}: ${nameOfExpressionType}`,
            },
            range: undefined,
        };
    }

    protected static getHoverForScopeItem(
        context: HoverProviderContext,
        nodeScope: Inspection.NodeScope,
        scopeType: Inspection.ScopeTypeByKey,
    ): Hover | undefined {
        const identifierLiteral: string = context.identifier;
        const maybeScopeItem: Inspection.TScopeItem | undefined = nodeScope.get(identifierLiteral);

        if (maybeScopeItem === undefined || maybeScopeItem.kind === Inspection.ScopeItemKind.Undefined) {
            return undefined;
        }

        const scopeItemText: string = InspectionUtils.getScopeItemKindText(maybeScopeItem.kind);

        const maybeScopeItemType: Type.TPowerQueryType | undefined = scopeType.get(identifierLiteral);

        const scopeItemTypeText: string =
            maybeScopeItemType !== undefined ? TypeUtils.nameOf(maybeScopeItemType) : "unknown";

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
