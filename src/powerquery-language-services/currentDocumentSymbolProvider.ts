// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, DocumentSymbol, Hover, MarkupKind, SignatureHelp } from "vscode-languageserver-types";

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

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        const maybeNodeScope: PQP.Inspection.NodeScope | undefined = this.maybeNodeScope();
        if (maybeNodeScope === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const identifier: string = context.identifier;

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "foo",
                value: `identifier = ${identifier}`,
            },
            range: undefined,
        };
    }

    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        // TODO: store parser/node info so we can reconstruct the function parameters
        // tslint:disable-next-line: no-null-keyword
        return null;
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

    private getDocumentSymbols(): DocumentSymbol[] {
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
