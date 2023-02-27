// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { Hover, MarkupKind, SignatureHelp, SignatureInformation } from "vscode-languageserver-types";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    AutocompleteItemProviderContext,
    HoverProviderContext,
    ILibraryProvider,
    SignatureProviderContext,
} from "./commonTypes";
import { ExternalType, Inspection } from "..";
import { Library, LibraryUtils } from "../library";
import { AutocompleteItemUtils } from "../inspection";
import { ProviderTraceConstant } from "../trace";

export class LibraryProvider implements ILibraryProvider {
    public readonly externalTypeResolver: ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;
    protected readonly signatureInformationByLabel: Map<string, SignatureInformation>;

    constructor(library: Library.ILibrary, protected readonly locale: string) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
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

            for (const [label, definition] of this.libraryDefinitions.entries()) {
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
            const definition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(identifierLiteral);

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
            const definition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(identifierLiteral);

            if (!LibraryUtils.isFunction(definition)) {
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
            const definition: Library.LibraryFunction = LibraryUtils.assertAsFunction(this.libraryDefinitions.get(key));
            this.signatureInformationByLabel.set(key, LibraryUtils.signatureInformation(definition));
        }

        return Assert.asDefined(this.signatureInformationByLabel.get(key));
    }
}
