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

import * as InspectionUtils from "../inspectionUtils";
import {
    AutocompleteItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";
import { Inspection, Library } from "..";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import { InspectionSettings } from "../inspectionSettings";

export class LocalDocumentSymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;

    constructor(
        library: Library.ILibrary,
        private readonly maybeTriedInspection: WorkspaceCache.InspectionCacheItem,
        private readonly createInspectionSettingsFn: () => InspectionSettings,
    ) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
    }

    // eslint-disable-next-line require-await
    public async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
        const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();

        if (maybeInspection === undefined) {
            return [];
        }

        return [
            ...this.getAutocompleteItemsFromFieldAccess(maybeInspection),
            ...InspectionUtils.getAutocompleteItemsFromScope(context, maybeInspection),
        ];
    }

    // eslint-disable-next-line require-await
    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        if (!WorkspaceCacheUtils.isInspectionTask(this.maybeTriedInspection)) {
            return null;
        }

        const activeNode: Inspection.TMaybeActiveNode = this.maybeTriedInspection.maybeActiveNode;

        if (!Inspection.ActiveNodeUtils.isPositionInBounds(activeNode)) {
            return null;
        }

        const inspection: WorkspaceCache.InspectionCacheItem = this.maybeTriedInspection;

        let maybeHover: Hover | undefined = LocalDocumentSymbolProvider.getHoverForIdentifierPairedExpression(
            context,
            this.createInspectionSettingsFn(),
            this.maybeTriedInspection,
            activeNode,
        );

        if (maybeHover !== undefined) {
            return maybeHover;
        }

        if (!ResultUtils.isOk(inspection.triedNodeScope) || !ResultUtils.isOk(inspection.triedScopeType)) {
            return null;
        }

        maybeHover = LocalDocumentSymbolProvider.getHoverForScopeItem(
            context,
            inspection.triedNodeScope.value,
            inspection.triedScopeType.value,
        );

        return maybeHover ?? null;
    }

    // eslint-disable-next-line require-await
    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        const maybeInvokeInspection: Inspection.InvokeExpression | undefined =
            this.getMaybeInspectionInvokeExpression();

        if (maybeInvokeInspection === undefined) {
            return null;
        }

        const inspection: Inspection.InvokeExpression = maybeInvokeInspection;

        if (inspection.maybeName && !inspection.isNameInLocalScope) {
            return null;
        }

        return InspectionUtils.getMaybeSignatureHelp(context);
    }

    // When hovering over a key it should show the type for the value.
    // Covers:
    //  * GeneralizedIdentifierPairedAnyLiteral
    //  * GeneralizedIdentifierPairedExpression
    //  * IdentifierPairedExpression
    protected static getHoverForIdentifierPairedExpression(
        context: HoverProviderContext,
        inspectionSettings: InspectionSettings,
        inspectionTask: WorkspaceCache.InspectionTask,
        activeNode: Inspection.ActiveNode,
    ): Hover | undefined {
        const parseState: ParseState = inspectionTask.parseState;
        const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
        const maybeLeafKind: Ast.NodeKind | undefined = ancestry[0]?.node.kind;

        const isValidLeafNodeKind: boolean = [Ast.NodeKind.GeneralizedIdentifier, Ast.NodeKind.Identifier].includes(
            maybeLeafKind,
        );

        if (!isValidLeafNodeKind) {
            return undefined;
        }

        const maybeIdentifierPairedExpression: TXorNode | undefined = AncestryUtils.maybeNthXorChecked(
            activeNode.ancestry,
            1,
            [
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                Ast.NodeKind.GeneralizedIdentifierPairedExpression,
                Ast.NodeKind.IdentifierPairedExpression,
            ],
        );

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

        const triedExpressionType: Inspection.TriedType = Inspection.tryType(
            inspectionSettings,
            parseState.contextState.nodeIdMapCollection,
            maybeExpression.node.id,
            inspectionTask.typeCache,
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

    private getMaybeInspection(): Inspection.Inspection | undefined {
        const inspectionCacheItem: WorkspaceCache.InspectionCacheItem = this.maybeTriedInspection;

        if (!WorkspaceCacheUtils.isInspectionTask(inspectionCacheItem)) {
            return undefined;
        } else {
            return inspectionCacheItem;
        }
    }

    private getMaybeInspectionInvokeExpression(): Inspection.InvokeExpression | undefined {
        const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();

        return maybeInspection !== undefined && ResultUtils.isOk(maybeInspection.triedCurrentInvokeExpression)
            ? maybeInspection.triedCurrentInvokeExpression.value
            : undefined;
    }

    private getAutocompleteItemsFromFieldAccess(
        inspection: Inspection.Inspection,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        const triedFieldAccess: Inspection.TriedAutocompleteFieldAccess = inspection.autocomplete.triedFieldAccess;

        return ResultUtils.isOk(triedFieldAccess) && triedFieldAccess.value !== undefined
            ? triedFieldAccess.value.autocompleteItems
            : [];
    }
}
