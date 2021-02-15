// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import {
    CompletionItem,
    CompletionItemKind,
    Hover,
    MarkupKind,
    Range,
    SignatureHelp,
    SignatureInformation,
} from "vscode-languageserver-types";

import { Library, LibraryUtils } from "../library";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    ISymbolProvider,
    SignatureProviderContext,
} from "./commonTypes";

export class LibrarySymbolProvider implements ISymbolProvider {
    public readonly externalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;
    protected readonly signatureInformationByLabel: Map<string, SignatureInformation[]>;

    constructor(library: Library.ILibrary) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
        this.signatureInformationByLabel = new Map();
    }

    public async getCompletionItems(context: CompletionItemProviderContext): Promise<ReadonlyArray<CompletionItem>> {
        if (!context.text || !context.range) {
            return [];
        }
        const identifierLiteral: string = context.text;
        const range: Range = context.range;

        const result: CompletionItem[] = [];
        for (const [key, value] of this.libraryDefinitions.entries()) {
            if (key.startsWith(identifierLiteral)) {
                result.push({
                    label: key,
                    kind: LibrarySymbolProvider.getCompletionItemKind(value.kind),
                    documentation: value.description,
                    textEdit: {
                        newText: key,
                        range,
                    },
                });
            }
        }

        return result;
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        if (!context.identifier) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }
        const identifierLiteral: string = context.identifier;

        const maybeDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(context.identifier);
        if (maybeDefinition === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }
        const definition: Library.TLibraryDefinition = maybeDefinition;

        const definitionText: string = LibrarySymbolProvider.getDefinitionKindText(definition.kind);
        const definitionTypeText: string = PQP.Language.TypeUtils.nameOf(definition.asType);

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
            // tslint:disable-next-line: no-null-keyword
            return null;
        }
        const identifierLiteral: string = context.functionName;

        const maybeDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(identifierLiteral);
        if (!LibraryUtils.isInvocable(maybeDefinition)) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        return {
            activeParameter: context.argumentOrdinal ?? 0,
            // TODO: support more than the first signature.
            activeSignature: 0,
            signatures: this.getOrCreateSignatureInformation(identifierLiteral),
        };
    }

    private static getDefinitionKindText(kind: Library.LibraryDefinitionKind): string {
        switch (kind) {
            case Library.LibraryDefinitionKind.Constructor:
            case Library.LibraryDefinitionKind.Function:
                return "library function";

            case Library.LibraryDefinitionKind.Constant:
                return "library constant";

            case Library.LibraryDefinitionKind.Type:
                return "library type";

            default:
                throw PQP.Assert.isNever(kind);
        }
    }

    private static getCompletionItemKind(kind: Library.LibraryDefinitionKind): CompletionItemKind {
        switch (kind) {
            case Library.LibraryDefinitionKind.Constructor:
            case Library.LibraryDefinitionKind.Function:
                return CompletionItemKind.Function;

            case Library.LibraryDefinitionKind.Constant:
                return CompletionItemKind.Constant;

            case Library.LibraryDefinitionKind.Type:
                return CompletionItemKind.TypeParameter;

            default:
                throw PQP.Assert.isNever(kind);
        }
    }

    private getOrCreateSignatureInformation(key: string): SignatureInformation[] {
        if (!this.signatureInformationByLabel.has(key)) {
            const definition: Library.TInvocable = LibraryUtils.assertAsInvocable(this.libraryDefinitions.get(key));
            this.signatureInformationByLabel.set(
                key,
                definition.signatures.map(LibraryUtils.createSignatureInformation),
            );
        }

        return PQP.Assert.asDefined(this.signatureInformationByLabel.get(key));
    }
}
