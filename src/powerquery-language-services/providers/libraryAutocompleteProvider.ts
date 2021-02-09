// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Library } from "..";
import { CompletionItem, CompletionItemKind } from "../commonTypes";
import { CompletionItemProvider, CompletionItemProviderContext } from "./commonTypes";

export class LibraryAutocompleteProvider implements CompletionItemProvider {
    constructor(private readonly maybeLibrary: Library.ILibrary | undefined) {}

    public async getCompletionItems(context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
        if (this.maybeLibrary === undefined || !context.text) {
            return [];
        }
        const text: string = context.text;

        const completionItems: CompletionItem[] = [];
        for (const [key, value] of this.maybeLibrary.libraryDefinitions.entries()) {
            if (key.startsWith(text)) {
                completionItems.push({
                    label: key,
                    kind: LibraryAutocompleteProvider.getCompletionItemKind(value.kind),
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
