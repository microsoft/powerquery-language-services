// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";

import { Inspection, Library } from "..";
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

    // We might be hovering over the key in a key-value-pair (eg. an entry in a record).
    // In that case then get the hover details for the value instead of the key.
    public async getHoverForIdentifierPairedExpression(
        inspectionTask: WorkspaceCache.InspectionTask,
        activeNode: Inspection.ActiveNode,
    ): Promise<Hover | null> {
        const parseState: PQP.Parser.ParseState = inspectionTask.parseState;
        const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
        const maybeLeaf: PQP.Parser.TXorNode | undefined = ancestry[0];

        if (!maybeLeaf || maybeLeaf.node.kind !== PQP.Language.Ast.NodeKind.Identifier) {
            return null;
        }

        const maybeIdentifierPairedExpression:
            | PQP.Parser.TXorNode
            | undefined = PQP.Parser.AncestryUtils.maybeNthXor(activeNode.ancestry, 1, [
            PQP.Language.Ast.NodeKind.IdentifierPairedExpression,
        ]);

        // We're on an identifier in some other context which we don't support.
        if (maybeIdentifierPairedExpression === undefined) {
            return null;
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
            return null;
        }

        Inspection.tryType();
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        if (!WorkspaceCacheUtils.isInspectionTask(this.maybeTriedInspection)) {
            return null;
        }

        const activeNode: Inspection.TMaybeActiveNode = this.maybeTriedInspection.maybeActiveNode;
        if (!Inspection.ActiveNodeUtils.isPositionInBounds(activeNode)) {
            return null;
        }

        const parseState: PQP.Parser.ParseState = this.maybeTriedInspection.parseState;
        const ancestry: ReadonlyArray<PQP.Parser.TXorNode> = activeNode.ancestry;
        const maybeLeaf: PQP.Parser.TXorNode | undefined = ancestry[0];

        // We might be hovering over the key in a key-value-pair (eg. an entry in a record).
        // In that case then get the hover details for the value instead of the key.
        if (maybeLeaf?.node.kind === PQP.Language.Ast.NodeKind.Identifier) {
            const maybeIdentifierPairedExpression:
                | PQP.Parser.TXorNode
                | undefined = PQP.Parser.AncestryUtils.maybeNthXor(activeNode.ancestry, 1, [
                PQP.Language.Ast.NodeKind.IdentifierPairedExpression,
            ]);

            // We're on an identifier in some other context which we don't support.
            if (maybeIdentifierPairedExpression === undefined) {
                return null;
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
                return null;
            }

            if (maybeIdentifierPairedExpression !== undefined) {
            }
        }

        // const maybeNodeScope: Inspection.NodeScope | undefined = this.maybeNodeScope();
        // if (maybeNodeScope === undefined) {
        //     // tslint:disable-next-line: no-null-keyword
        //     return null;
        // }

        // const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();
        // if (!maybeInspection || !Inspection.ActiveNodeUtils.isPositionInBounds(maybeInspection.maybeActiveNode)) {
        //     // tslint:disable-next-line: no-null-keyword
        //     return null;
        // }
        // const activeNode: Inspection.ActiveNode = maybeInspection.maybeActiveNode;

        // const maybeNodeScope: Inspection.NodeScope | undefined = this.maybeNodeScope();
        // if (maybeNodeScope === undefined) {
        //     // tslint:disable-next-line: no-null-keyword
        //     return null;
        // }

        // const identifierLiteral: string = context.identifier;
        // const maybeScopeItem: Inspection.TScopeItem | undefined = maybeNodeScope.get(identifierLiteral);
        // if (maybeScopeItem === undefined || maybeScopeItem.kind === Inspection.ScopeItemKind.Undefined) {
        //     // tslint:disable-next-line: no-null-keyword
        //     return null;
        // }

        // const scopeItemText: string = InspectionUtils.getScopeItemKindText(maybeScopeItem.kind);

        // const maybeScopeItemType: PQP.Language.Type.TPowerQueryType | undefined = this.maybeTypeFromIdentifier(
        //     identifierLiteral,
        // );
        // const scopeItemTypeText: string =
        //     maybeScopeItemType !== undefined ? PQP.Language.TypeUtils.nameOf(maybeScopeItemType) : "unknown";

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${scopeItemText}] ${identifierLiteral}: ${scopeItemTypeText}`,
            },
            range: undefined,
        };
    }

    public getHoverTarget(): PQP.Parser.TXorNode | undefined {
        const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();
        if (!maybeInspection || !Inspection.ActiveNodeUtils.isPositionInBounds(maybeInspection.maybeActiveNode)) {
            return undefined;
        }
        const activeNode: Inspection.ActiveNode = maybeInspection.maybeActiveNode;
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

    private maybeTypeFromIdentifier(identifier: string): PQP.Language.Type.TPowerQueryType | undefined {
        const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();

        return maybeInspection !== undefined && PQP.ResultUtils.isOk(maybeInspection.triedScopeType)
            ? maybeInspection.triedScopeType.value.get(identifier)
            : undefined;
    }

    private maybeNodeScope(): Inspection.NodeScope | undefined {
        const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();

        return maybeInspection !== undefined && PQP.ResultUtils.isOk(maybeInspection.triedNodeScope)
            ? maybeInspection.triedNodeScope.value
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
