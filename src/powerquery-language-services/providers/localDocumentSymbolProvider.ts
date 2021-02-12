// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItem, Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";

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

    public async getCompletionItems(context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
        const maybeInspection: PQP.Inspection.Inspection | undefined = this.getMaybeInspection();
        if (maybeInspection === undefined) {
            return [];
        }

        return [
            ...this.getCompletionItemsFromFieldAccess(context, maybeInspection),
            ...this.getCompletionItemsFromScope(context, maybeInspection),
        ];
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
            return {
                contents: {
                    kind: MarkupKind.PlainText,
                    language: "powerquery",
                    value: `[undefined] ${identifierLiteral}: ${PQP.Language.TypeUtils.nameOf(
                        PQP.Language.Type.UnknownInstance,
                    )}`,
                },
            };
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const scopeItemText: string = InspectionUtils.getScopeItemKindText(maybeScopeItem.kind);
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
        const maybeInspection: PQP.Inspection.Inspection | undefined = this.getMaybeInspection();

        // tslint:disable-next-line: no-null-keyword
        return maybeInspection !== undefined ? InspectionUtils.getMaybeSignatureHelp(context, maybeInspection) : null;
    }

    private getMaybeInspection(): PQP.Inspection.Inspection | undefined {
        const maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined = this.maybeTriedInspection;

        if (
            maybeTriedInspection === undefined ||
            maybeTriedInspection.kind === PQP.ResultKind.Err ||
            maybeTriedInspection.stage !== WorkspaceCache.CacheStageKind.Inspection
        ) {
            return undefined;
        } else {
            return maybeTriedInspection.value;
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

    private getCompletionItemsFromScope(
        context: CompletionItemProviderContext,
        inspection: PQP.Inspection.Inspection,
    ): ReadonlyArray<CompletionItem> {
        return LanguageServiceUtils.documentSymbolToCompletionItem(
            InspectionUtils.getSymbolsForInspectionScope(inspection, context.text),
        );
    }

    private getCompletionItemsFromFieldAccess(
        context: CompletionItemProviderContext,
        inspection: PQP.Inspection.Inspection,
    ): ReadonlyArray<CompletionItem> {
        return InspectionUtils.getCompletionItems(context, inspection);
    }
}
