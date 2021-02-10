// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import {
    CompletionItem,
    CompletionItemKind,
    DocumentSymbol,
    Hover,
    MarkupKind,
    SignatureHelp,
} from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";
import * as LanguageServiceUtils from "../languageServiceUtils";

import { Library } from "..";
import { WorkspaceCache } from "../workspaceCache";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";

export class LocalDocumentSymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;

    constructor(
        library: Library.ILibrary,
        private readonly maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined,
    ) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
    }

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
        return LanguageServiceUtils.documentSymbolToCompletionItem(this.getDocumentSymbols());
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        const maybeNodeScope: PQP.Inspection.NodeScope | undefined = this.maybeNodeScope();
        if (maybeNodeScope === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const identifierLiteral: string = context.identifier;
        const maybeScopeItem: PQP.Inspection.TScopeItem | undefined = maybeNodeScope.get(identifierLiteral);
        const maybeScopeItemType: PQP.Language.Type.TType | undefined = this.maybeTypeFromIdentifier(identifierLiteral);
        if (
            maybeScopeItem === undefined ||
            maybeScopeItemType === undefined ||
            maybeScopeItem.kind === PQP.Inspection.ScopeItemKind.Undefined
        ) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const scopeItemText: string = LocalDocumentSymbolProvider.getScopeItemKindText(maybeScopeItem.kind);
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

    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    private static getFieldAccessCompletionItems(
        triedFieldAccessAutocomplete: PQP.Inspection.TriedAutocompleteFieldAccess,
    ): ReadonlyArray<CompletionItem> {
        if (PQP.ResultUtils.isErr(triedFieldAccessAutocomplete) || triedFieldAccessAutocomplete.value === undefined) {
            return [];
        }

        return triedFieldAccessAutocomplete.value.autocompleteItems.map(
            (autocompleteItem: PQP.Inspection.AutocompleteItem) => {
                return {
                    kind: CompletionItemKind.Field,
                    label: autocompleteItem.key,
                };
            },
        );
    }

    private static getScopeItemKindText(scopeItemKind: PQP.Inspection.ScopeItemKind): string {
        switch (scopeItemKind) {
            case PQP.Inspection.ScopeItemKind.Each:
                return "each";

            case PQP.Inspection.ScopeItemKind.KeyValuePair:
                return "key";

            case PQP.Inspection.ScopeItemKind.Parameter:
                return "parameter";

            case PQP.Inspection.ScopeItemKind.SectionMember:
                return "section-member";

            case PQP.Inspection.ScopeItemKind.Undefined:
                return "unknown";

            default:
                throw PQP.Assert.isNever(scopeItemKind);
        }
    }

    private maybeTypeFromIdentifier(identifier: string): PQP.Language.Type.TType | undefined {
        const maybeInspection: PQP.Inspection.Inspection | undefined = this.maybeInspection();

        return maybeInspection !== undefined && PQP.ResultUtils.isOk(maybeInspection.triedScopeType)
            ? maybeInspection.triedScopeType.value.get(identifier)
            : undefined;
    }

    private maybeInspection(): PQP.Inspection.Inspection | undefined {
        if (
            this.maybeTriedInspection === undefined ||
            this.maybeTriedInspection.kind === PQP.ResultKind.Err ||
            this.maybeTriedInspection.stage !== WorkspaceCache.CacheStageKind.Inspection
        ) {
            return undefined;
        } else {
            return this.maybeTriedInspection.value;
        }
    }

    private maybeNodeScope(): PQP.Inspection.NodeScope | undefined {
        const maybeInspection: PQP.Inspection.Inspection | undefined = this.maybeInspection();

        return maybeInspection !== undefined && PQP.ResultUtils.isOk(maybeInspection.triedNodeScope)
            ? maybeInspection.triedNodeScope.value
            : undefined;
    }

    private getDocumentSymbols(): ReadonlyArray<DocumentSymbol> {
        if (
            this.maybeTriedInspection === undefined ||
            this.maybeTriedInspection.kind === PQP.ResultKind.Err ||
            this.maybeTriedInspection.stage !== WorkspaceCache.CacheStageKind.Inspection
        ) {
            return [];
        }
        return InspectionUtils.getSymbolsForInspectionScope(this.maybeTriedInspection.value);
    }
}
