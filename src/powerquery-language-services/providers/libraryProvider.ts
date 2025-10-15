// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, type CommonError, type Result, ResultUtils } from "@microsoft/powerquery-parser";
import { type Hover, MarkupKind, type SignatureHelp, type SignatureInformation } from "vscode-languageserver-types";
import { type Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    type AutocompleteItemProviderContext,
    type HoverProviderContext,
    type ILibraryProvider,
    type SignatureProviderContext,
} from "./commonTypes";
import { Library, LibraryDefinitionUtils, LibraryUtils } from "../library";
import { AutocompleteItemUtils } from "../inspection";
import { type Inspection } from "..";
import { ProviderTraceConstant } from "../trace";

export class LibraryProvider implements ILibraryProvider {
    public readonly library: Library.ILibrary;
    protected readonly locale: string;
    protected readonly signatureInformationByLabel: Map<string, SignatureInformation>;

    constructor(library: Library.ILibrary, locale: string) {
        this.library = library;
        this.locale = locale;
        this.signatureInformationByLabel = new Map();
    }

    public async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        // eslint-disable-next-line require-await
        return await ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LibrarySymbolProvider,
                this.getAutocompleteItems.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            if (!context.text || !context.range) {
                trace.exit({ invalidContext: true });

                return undefined;
            }

            const autocompleteItems: Inspection.AutocompleteItem[] = [];
            const contextText: string | undefined = context.text;

            for (const [label, definition] of this.library.libraryDefinitions.staticLibraryDefinitions.entries()) {
                autocompleteItems.push(AutocompleteItemUtils.fromLibraryDefinition(label, definition, contextText));
            }

            for (const [label, definition] of this.library.libraryDefinitions.dynamicLibraryDefinitions().entries()) {
                autocompleteItems.push(AutocompleteItemUtils.fromLibraryDefinition(label, definition, contextText));
            }

            trace.exit();

            return autocompleteItems;
        }, this.locale);
    }

    public async getHover(context: HoverProviderContext): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        // eslint-disable-next-line require-await
        return await ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LibrarySymbolProvider,
                this.getHover.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            if (!context.identifier) {
                trace.exit({ invalidContext: true });

                return undefined;
            }

            const identifierLiteral: string = context.identifier.literal;

            const definition: Library.TLibraryDefinition | undefined = LibraryUtils.getDefinition(
                this.library,
                identifierLiteral,
            );

            if (definition === undefined) {
                trace.exit({ invalidContext: true });

                return undefined;
            }

            const definitionText: string = LibraryProvider.getDefinitionKindText(definition.kind);

            const definitionTypeText: string = TypeUtils.nameOf(
                definition.asPowerQueryType,
                context.traceManager,
                trace.id,
            );

            context.cancellationToken?.throwIfCancelled();

            const hover: Hover = {
                contents: {
                    kind: MarkupKind.PlainText,
                    language: "powerquery",
                    value: `[${definitionText}] ${identifierLiteral}: ${definitionTypeText}`,
                },
                range: undefined,
            };

            trace.exit();

            return hover;
        }, this.locale);
    }

    public async getSignatureHelp(
        context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        // eslint-disable-next-line require-await
        return await ResultUtils.ensureResultAsync(async () => {
            const trace: Trace = context.traceManager.entry(
                ProviderTraceConstant.LibrarySymbolProvider,
                this.getSignatureHelp.name,
                context.initialCorrelationId,
            );

            context.cancellationToken?.throwIfCancelled();

            if (!context.functionName) {
                trace.exit({ invalidContext: true });

                return undefined;
            }

            const identifierLiteral: string = context.functionName;

            const definition: Library.TLibraryDefinition | undefined = LibraryUtils.getDefinition(
                this.library,
                identifierLiteral,
            );

            if (!LibraryDefinitionUtils.isFunction(definition)) {
                trace.exit({ invalidContext: true });

                return undefined;
            }

            const result: SignatureHelp = {
                activeParameter: context.argumentOrdinal ?? 0,
                activeSignature: 0,
                signatures: [this.getOrCreateSignatureInformation(identifierLiteral)],
            };

            trace.exit();

            return result;
        }, this.locale);
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
            const definition: Library.LibraryFunction = LibraryDefinitionUtils.assertAsFunction(
                LibraryDefinitionUtils.getDefinition(this.library.libraryDefinitions, key),
            );

            this.signatureInformationByLabel.set(key, LibraryUtils.signatureInformation(definition));
        }

        return Assert.asDefined(this.signatureInformationByLabel.get(key));
    }
}
