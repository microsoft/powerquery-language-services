// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, DocumentSymbol, Hover, SignatureHelp } from "vscode-languageserver-types";

import {
    CompletionItemProviderContext,
    HoverProviderContext,
    SignatureProviderContext,
    SymbolProvider,
} from "./providers";
import { LanguageServiceUtils, InspectionUtils } from ".";

export class CurrentDocumentSymbolProvider implements SymbolProvider {
    constructor(private readonly maybeTriedInspection: undefined | PQP.Task.TriedInspection) {}

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
        if (this.maybeTriedInspection === undefined || PQP.ResultUtils.isErr(this.maybeTriedInspection)) {
            return [];
        }
        return InspectionUtils.getSymbolsForInspectionScope(this.maybeTriedInspection.value);
    }
}
