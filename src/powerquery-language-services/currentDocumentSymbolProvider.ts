// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, DocumentSymbol, Hover, SignatureHelp } from "vscode-languageserver-types";

import * as InspectionUtils from "./inspectionUtils";
import * as LanguageServiceUtils from "./languageServiceUtils";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    SignatureProviderContext,
    SymbolProvider,
} from "./providers";
import * as WorkspaceCache from "./workspaceCache";

export class CurrentDocumentSymbolProvider implements SymbolProvider {
    constructor(private readonly maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined) {}

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return LanguageServiceUtils.documentSymbolToCompletionItem(this.getDocumentSymbols());
    }

    public async getHover(_context: HoverProviderContext): Promise<Hover | null> {
        // TODO: implement - documentSymbols should be a map
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        // TODO: store parser/node info so we can reconstruct the function parameters
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    private getDocumentSymbols(): DocumentSymbol[] {
        if (
            this.maybeTriedInspection === undefined ||
            this.maybeTriedInspection.kind === PQP.ResultKind.Err ||
            this.maybeTriedInspection.stage !== WorkspaceCache.CacheStageKind.Inspection
        ) {
            return [];
        }

        return InspectionUtils.getSymbolsForTriedNodeScope(this.maybeTriedInspection.value.triedNodeScope);
    }
}
