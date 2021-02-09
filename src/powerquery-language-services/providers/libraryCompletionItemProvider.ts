// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Library } from "..";
import type { CompletionItem } from "../commonTypes";
import { CompletionItemKind } from "../commonTypes";
import type { CompletionItemProvider, CompletionItemProviderContext } from "./commonTypes";

export class LibraryCompletionItemProvider implements CompletionItemProvider {
    constructor(private readonly library: Library.ILibrary) {}

    public async getCompletionItems(context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
        if (!context.text) {
            return [];
        }
        const text: string = context.text;

        const completionItems: CompletionItem[] = [];
        for (const [key, value] of this.library.libraryDefinitions.entries()) {
            if (key.startsWith(text)) {
                completionItems.push({
                    label: key,
                    kind: LibraryCompletionItemProvider.getCompletionItemKind(value.kind),
                });
            }
        }

        return completionItems;
    }

    private static getCompletionItemKind(libraryDefinitionKind: Library.LibraryDefinitionKind): CompletionItemKind {
        switch (libraryDefinitionKind) {
            case Library.LibraryDefinitionKind.Constructor:
            case Library.LibraryDefinitionKind.Function:
                return CompletionItemKind.Function;

            case Library.LibraryDefinitionKind.Constant:
                return CompletionItemKind.Constant;

            case Library.LibraryDefinitionKind.Type:
                return CompletionItemKind.Variable;

            default:
                throw PQP.Assert.isNever(libraryDefinitionKind);
        }
    }
}
