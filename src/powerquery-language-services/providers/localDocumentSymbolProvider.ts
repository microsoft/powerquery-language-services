// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";

import { Inspection, Library } from "..";
import { EmptyHover } from "../commonTypes";
import { InspectionSettings } from "../inspectionSettings";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import {
    AutocompleteItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";

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

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        if (!WorkspaceCacheUtils.isInspectionTask(this.maybeTriedInspection)) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const activeNode: Inspection.TMaybeActiveNode = this.maybeTriedInspection.maybeActiveNode;
        if (!Inspection.ActiveNodeUtils.isPositionInBounds(activeNode)) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }
        const inspection: WorkspaceCache.InspectionCacheItem = this.maybeTriedInspection;

        let maybeHover: Hover | undefined = await LocalDocumentSymbolProvider.getHoverForIdentifierPairedExpression(
            context,
            this.createInspectionSettingsFn(),
            this.maybeTriedInspection,
            activeNode,
        );

        if (maybeHover !== undefined) {
            return maybeHover;
        }

        if (!PQP.ResultUtils.isOk(inspection.triedNodeScope) || !PQP.ResultUtils.isOk(inspection.triedScopeType)) {
            return EmptyHover;
        }

        maybeHover = await LocalDocumentSymbolProvider.getHoverForScopeItem(
            context,
            inspection.triedNodeScope.value,
            inspection.triedScopeType.value,
        );

        return maybeHover ?? EmptyHover;
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        const maybeInvokeInspection:
            | Inspection.InvokeExpression
            | undefined = this.getMaybeInspectionInvokeExpression();
        if (maybeInvokeInspection === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }
        const inspection: Inspection.InvokeExpression = maybeInvokeInspection;

        if (inspection.maybeName && !inspection.isNameInLocalScope) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        return InspectionUtils.getMaybeSignatureHelp(context);
    }

    // When hovering over a key it should show the type for the value.
    // Covers:
    //  * GeneralizedIdentifierPairedAnyLiteral
    //  * GeneralizedIdentifierPairedExpression
    //  * IdentifierPairedExpression
    protected static async getHoverForIdentifierPairedExpression(
        context: HoverProviderContext,
        inspectionSettings: InspectionSettings,
        inspectionTask: WorkspaceCache.InspectionTask,
        activeNode: Inspection.ActiveNode,
    ): Promise<Hover | undefined> {
        const parseState: PQP.Parser.ParseState = inspectionTask.parseState;
        const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
        const maybeLeafKind: PQP.Language.Ast.NodeKind | undefined = ancestry[0]?.node.kind;

        const isValidLeafNodeKind: boolean = [
            PQP.Language.Ast.NodeKind.GeneralizedIdentifier,
            PQP.Language.Ast.NodeKind.Identifier,
        ].includes(maybeLeafKind);

        if (!isValidLeafNodeKind) {
            return undefined;
        }

        const maybeIdentifierPairedExpression:
            | PQP.Parser.TXorNode
            | undefined = PQP.Parser.AncestryUtils.maybeNthXor(activeNode.ancestry, 1, [
            PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
            PQP.Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression,
            PQP.Language.Ast.NodeKind.IdentifierPairedExpression,
        ]);

        // We're on an identifier in some other context which we don't support.
        if (maybeIdentifierPairedExpression === undefined) {
            return undefined;
        }

        const maybeExpression:
            | PQP.Parser.TXorNode
            | undefined = PQP.Parser.NodeIdMapUtils.maybeChildXorByAttributeIndex(
            parseState.contextState.nodeIdMapCollection,
            maybeIdentifierPairedExpression.node.id,
            2,
            undefined,
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
        if (PQP.ResultUtils.isError(triedExpressionType)) {
            return undefined;
        }

        let scopeItemText: string = "unknown";
        // If it's a SectionMember
        const maybeThirdNodeKind: PQP.Language.Ast.NodeKind = ancestry[2]?.node.kind;
        if (maybeThirdNodeKind === PQP.Language.Ast.NodeKind.SectionMember) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.SectionMember);
        }

        // Else if it's RecordExpression or RecordLiteral
        const maybeFifthNodeKind: PQP.Language.Ast.NodeKind = ancestry[4]?.node.kind;
        const isRecordNodeKind: boolean = [
            PQP.Language.Ast.NodeKind.RecordExpression,
            PQP.Language.Ast.NodeKind.RecordLiteral,
        ].includes(maybeFifthNodeKind);

        if (isRecordNodeKind) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.RecordField);
        } else if (maybeFifthNodeKind === PQP.Language.Ast.NodeKind.LetExpression) {
            scopeItemText = InspectionUtils.getScopeItemKindText(Inspection.ScopeItemKind.LetVariable);
        }

        const nameOfExpressionType: string = PQP.Language.TypeUtils.nameOf(triedExpressionType.value);

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${scopeItemText}] ${context.identifier}: ${nameOfExpressionType}`,
            },
            range: undefined,
        };
    }

    protected static async getHoverForScopeItem(
        context: HoverProviderContext,
        nodeScope: Inspection.NodeScope,
        scopeType: Inspection.ScopeTypeByKey,
    ): Promise<Hover | undefined> {
        const identifierLiteral: string = context.identifier;
        const maybeScopeItem: Inspection.TScopeItem | undefined = nodeScope.get(identifierLiteral);
        if (maybeScopeItem === undefined || maybeScopeItem.kind === Inspection.ScopeItemKind.Undefined) {
            return undefined;
        }

        const scopeItemText: string = InspectionUtils.getScopeItemKindText(maybeScopeItem.kind);

        const maybeScopeItemType: PQP.Language.Type.TPowerQueryType | undefined = scopeType.get(identifierLiteral);
        const scopeItemTypeText: string =
            maybeScopeItemType !== undefined ? PQP.Language.TypeUtils.nameOf(maybeScopeItemType) : "unknown";

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

        return maybeInspection !== undefined && PQP.ResultUtils.isOk(maybeInspection.triedCurrentInvokeExpression)
            ? maybeInspection.triedCurrentInvokeExpression.value
            : undefined;
    }

    private getAutocompleteItemsFromFieldAccess(
        inspection: Inspection.Inspection,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        const triedFieldAccess: Inspection.TriedAutocompleteFieldAccess = inspection.autocomplete.triedFieldAccess;

        return PQP.ResultUtils.isOk(triedFieldAccess) && triedFieldAccess.value !== undefined
            ? triedFieldAccess.value.autocompleteItems
            : [];
    }
}
