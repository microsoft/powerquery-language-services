// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItem, DocumentSymbol, Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "../inspectionUtils";
import * as LanguageServiceUtils from "../languageServiceUtils";
import * as WorkspaceCache from "../workspaceCache";

import { Library, LibraryUtils } from "..";
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
            return this.getExternalHover(identifierLiteral);
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

    private async getExternalHover(identifierLiteral: string): Promise<Hover | null> {
        const maybeLibraryDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(
            identifierLiteral,
        );

        if (maybeLibraryDefinition === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }
        const libraryDefinition: Library.TLibraryDefinition = maybeLibraryDefinition;

        const definitionKindText: string = LibraryUtils.nameOf(libraryDefinition.kind);
        const libraryDefinitionTypeText: string = PQP.Language.TypeUtils.nameOf(libraryDefinition.asType);

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${definitionKindText}] ${identifierLiteral}: ${libraryDefinitionTypeText}`,
            },
            range: undefined,
        };
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
