// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParameterInformation, SignatureInformation } from "vscode-languageserver-types";
import { Assert } from "@microsoft/powerquery-parser";

import { ILibrary, LibraryDefinitionKind, LibraryFunction, LibraryParameter, TLibraryDefinition } from "./library";
import { LibraryDefinitionUtils } from ".";

export function getDefinition(library: ILibrary, identifierLiteral: string): TLibraryDefinition | undefined {
    return LibraryDefinitionUtils.getDefinition(library.libraryDefinitions, identifierLiteral);
}

export function getDefinitionKeys(library: ILibrary): ReadonlyArray<string> {
    return LibraryDefinitionUtils.getKeys(library.libraryDefinitions);
}

export function hasDefinition(library: ILibrary, key: string): boolean {
    return LibraryDefinitionUtils.hasDefinition(library.libraryDefinitions, key);
}

export function signatureInformation(libraryFunctionSignature: LibraryFunction): SignatureInformation {
    return {
        label: libraryFunctionSignature.label,
        documentation: libraryFunctionSignature.description,
        parameters: libraryFunctionSignature.parameters.map(parameterInformation),
    };
}

export function parameterInformation(libraryParameter: LibraryParameter): ParameterInformation {
    return {
        label: libraryParameter.label,
        documentation: undefined,
    };
}

export function nameOf(kind: LibraryDefinitionKind): string {
    switch (kind) {
        case LibraryDefinitionKind.Function:
            return "library function";

        case LibraryDefinitionKind.Constant:
            return "library constant";

        case LibraryDefinitionKind.Type:
            return "library type";

        default:
            throw Assert.isNever(kind);
    }
}
