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
import { Library, LibraryUtils } from "../library";
import { AutocompleteItemUtils } from "../inspection";
import { Inspection } from "..";
import { ProviderTraceConstant } from "../trace";

export class LibraryProvider implements ILibraryProvider {
    public readonly externalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn;
    public readonly libraryDefinitions: Library.LibraryDefinitions;
    protected readonly signatureInformationByLabel: Map<string, SignatureInformation>;

    constructor(library: Library.ILibrary) {
        this.externalTypeResolver = library.externalTypeResolver;
        this.libraryDefinitions = library.libraryDefinitions;
        this.signatureInformationByLabel = new Map();
    }

    // eslint-disable-next-line require-await
    public async getAutocompleteItems(
        context: AutocompleteItemProviderContext,
    ): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LibrarySymbolProvider,
            this.getAutocompleteItems.name,
            context.maybeInitialCorrelationId,
        );

        context.maybeCancellationToken?.throwIfCancelled();

        if (!context.text || !context.range) {
            trace.exit({ invalidContext: true });

            return ResultUtils.boxOk(undefined);
        }

        const autocompleteItems: Inspection.AutocompleteItem[] = [];
        const maybeContextText: string | undefined = context.text;

        for (const [label, definition] of this.libraryDefinitions.entries()) {
            autocompleteItems.push(
                AutocompleteItemUtils.createFromLibraryDefinition(label, definition, maybeContextText),
            );
        }

        trace.exit();

        return ResultUtils.boxOk(autocompleteItems);
    }

    // eslint-disable-next-line require-await
    public async getHover(context: HoverProviderContext): Promise<Result<Hover | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LibrarySymbolProvider,
            this.getHover.name,
            context.maybeInitialCorrelationId,
        );

        context.maybeCancellationToken?.throwIfCancelled();

        if (!context.identifier) {
            trace.exit({ invalidContext: true });

            return ResultUtils.boxOk(undefined);
        }

        const identifierLiteral: string = context.identifier.literal;
        const maybeDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(identifierLiteral);

        if (maybeDefinition === undefined) {
            trace.exit({ invalidContext: true });

            return ResultUtils.boxOk(undefined);
        }

        const definition: Library.TLibraryDefinition = maybeDefinition;
        const definitionText: string = LibraryProvider.getDefinitionKindText(definition.kind);

        const definitionTypeText: string = TypeUtils.nameOf(
            definition.asPowerQueryType,
            context.traceManager,
            trace.id,
        );

        context.maybeCancellationToken?.throwIfCancelled();

        const hover: Hover = {
            contents: {
                kind: MarkupKind.PlainText,
                language: "powerquery",
                value: `[${definitionText}] ${identifierLiteral}: ${definitionTypeText}`,
            },
            range: undefined,
        };

        trace.exit();

        return ResultUtils.boxOk(hover);
    }

    // eslint-disable-next-line require-await
    public async getSignatureHelp(
        context: SignatureProviderContext,
    ): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
        const trace: Trace = context.traceManager.entry(
            ProviderTraceConstant.LibrarySymbolProvider,
            this.getSignatureHelp.name,
            context.maybeInitialCorrelationId,
        );

        context.maybeCancellationToken?.throwIfCancelled();

        if (!context.functionName) {
            trace.exit({ invalidContext: true });

            return ResultUtils.boxOk(undefined);
        }

        const identifierLiteral: string = context.functionName;
        const maybeDefinition: Library.TLibraryDefinition | undefined = this.libraryDefinitions.get(identifierLiteral);

        if (!LibraryUtils.isFunction(maybeDefinition)) {
            trace.exit({ invalidContext: true });

            return ResultUtils.boxOk(undefined);
        }

        const result: SignatureHelp = {
            activeParameter: context.argumentOrdinal ?? 0,
            activeSignature: 0,
            signatures: [this.getOrCreateSignatureInformation(identifierLiteral)],
        };

        trace.exit();

        return ResultUtils.boxOk(result);
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
