// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Hover, MarkupKind, SignatureHelp, SignatureInformation } from "vscode-languageserver-types";
import { Assert } from "@microsoft/powerquery-parser";
import { TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    AutocompleteItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";
import { Library, LibraryUtils } from "../library";
import { AutocompleteItemUtils } from "../inspection";
import { Inspection } from "..";

export class LibrarySymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;
    protected readonly signatureInformationByLabel: Map<string, SignatureInformation>;

    constructor(library: Library.ILibrary) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
        this.signatureInformationByLabel = new Map();
    }

    public async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
        if (!context.text || !context.range) {
            return [];
        }

        const partial: Inspection.AutocompleteItem[] = [];
        const maybeContextText: string | undefined = context.text;

        for (const [label, definition] of this.libraryDefinitions.entries()) {
            partial.push(AutocompleteItemUtils.createFromLibraryDefinition(label, definition, maybeContextText));
        }

        return partial;
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        if (!context.identifier) {
            return null;
        }

        const identifierLiteral: string = context.identifier;

        const maybeDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(context.identifier);

        if (maybeDefinition === undefined) {
            return null;
        }

        const definition: Library.TLibraryDefinition = maybeDefinition;

        const definitionText: string = LibrarySymbolProvider.getDefinitionKindText(definition.kind);
        const definitionTypeText: string = TypeUtils.nameOf(definition.asPowerQueryType);

        return {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${definitionText}] ${identifierLiteral}: ${definitionTypeText}`,
            },
            range: undefined,
        };
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        if (!context.functionName) {
            return null;
        }

        const identifierLiteral: string = context.functionName;

        const maybeDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(identifierLiteral);

        if (!LibraryUtils.isFunction(maybeDefinition)) {
            return null;
        }

        return {
            activeParameter: context.argumentOrdinal ?? 0,
            activeSignature: 0,
            signatures: [this.getOrCreateSignatureInformation(identifierLiteral)],
        };
    }

    private static getDefinitionKindText(kind: Library.LibraryDefinitionKind): string {
        switch (kind) {
            case Library.LibraryDefinitionKind.Function:
                return "library function";

            case Library.LibraryDefinitionKind.Constant:
                return "library constant";

            case Library.LibraryDefinitionKind.Type:
                return "library type";

            default:
                throw Assert.isNever(kind);
        }
    }

    private getOrCreateSignatureInformation(key: string): SignatureInformation {
        if (!this.signatureInformationByLabel.has(key)) {
            const definition: Library.LibraryFunction = LibraryUtils.assertAsFunction(this.libraryDefinitions.get(key));
            this.signatureInformationByLabel.set(key, LibraryUtils.createSignatureInformation(definition));
        }

        return Assert.asDefined(this.signatureInformationByLabel.get(key));
    }
}
