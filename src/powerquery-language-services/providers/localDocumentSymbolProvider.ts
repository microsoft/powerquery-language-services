// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";

import { Inspection, Library } from "..";
import { AutocompleteItemUtils } from "../inspection";
import { WorkspaceCache, WorkspaceCacheUtils } from "../workspaceCache";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";

export class LocalDocumentSymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;

    constructor(library: Library.ILibrary, private readonly maybeTriedInspection: WorkspaceCache.InspectionCacheItem) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
    }

    public async getAutocompleteItems(
        context: CompletionItemProviderContext,
    ): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
        const maybeInspection: Inspection.Inspection | undefined = this.getMaybeInspection();
        if (maybeInspection === undefined) {
            return [];
        }

        return [
            ...this.getAutocompleteItemsFromFieldAccess(context, maybeInspection),
            ...this.getCompletionItemsFromScope(context, maybeInspection),
        ];
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        const maybeNodeScope: Inspection.NodeScope | undefined = this.maybeNodeScope();
        if (maybeNodeScope === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const identifierLiteral: string = context.identifier;
        const maybeScopeItem: Inspection.TScopeItem | undefined = maybeNodeScope.get(identifierLiteral);
        if (maybeScopeItem === undefined || maybeScopeItem.kind === Inspection.ScopeItemKind.Undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const scopeItemText: string = InspectionUtils.getScopeItemKindText(maybeScopeItem.kind);

        const maybeScopeItemType: PQP.Language.Type.PowerQueryType | undefined = this.maybeTypeFromIdentifier(
            identifierLiteral,
        );
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

        return maybeInspection !== undefined && PQP.ResultUtils.isOk(maybeInspection.triedInvokeExpression)
            ? maybeInspection.triedInvokeExpression.value
            : undefined;
    }

    private maybeTypeFromIdentifier(identifier: string): PQP.Language.Type.PowerQueryType | undefined {
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

    private getCompletionItemsFromScope(
        context: CompletionItemProviderContext,
        inspection: Inspection.Inspection,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        if (PQP.ResultUtils.isError(inspection.triedNodeScope)) {
            return [];
        }
        const nodeScope: Inspection.NodeScope = inspection.triedNodeScope.value;
        const scopeTypeByKey: Inspection.ScopeTypeByKey = PQP.ResultUtils.isOk(inspection.triedScopeType)
            ? inspection.triedScopeType.value
            : new Map();

        const partial: Inspection.AutocompleteItem[] = [];

        for (const [label, scopeItem] of nodeScope.entries()) {
            const maybeAutocompleteItem:
                | Inspection.AutocompleteItem
                | undefined = AutocompleteItemUtils.maybeCreateFromScopeItem(
                label,
                scopeItem,
                scopeTypeByKey.get(label) ?? PQP.Language.Type.UnknownInstance,
                context.text,
            );

            if (maybeAutocompleteItem) {
                partial.push(maybeAutocompleteItem);
            }
        }

        return partial;
    }

    private getAutocompleteItemsFromFieldAccess(
        _context: CompletionItemProviderContext,
        inspection: Inspection.Inspection,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        const triedFieldAccess: Inspection.TriedAutocompleteFieldAccess = inspection.autocomplete.triedFieldAccess;

        return PQP.ResultUtils.isOk(triedFieldAccess) && triedFieldAccess.value !== undefined
            ? triedFieldAccess.value.autocompleteItems
            : [];
    }
}
