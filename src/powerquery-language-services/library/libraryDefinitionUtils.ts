// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItemKind, ParameterInformation, SignatureInformation } from "vscode-languageserver-types";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import {
    LibraryConstant,
    LibraryDefinitionKind,
    LibraryDefinitions,
    LibraryFunction,
    LibraryParameter,
    LibraryType,
    TLibraryDefinition,
} from "./library";
import { ExternalType } from "../externalType";

export function assertAsConstant(definition: TLibraryDefinition | undefined): LibraryConstant {
    assertIsConstant(definition);

    return definition;
}

export function assertAsFunction(definition: TLibraryDefinition | undefined): LibraryFunction {
    assertIsFunction(definition);

    return definition;
}

export function assertAsType(definition: TLibraryDefinition | undefined): LibraryType {
    assertIsType(definition);

    return definition;
}

export function assertIsConstant(definition: TLibraryDefinition | undefined): asserts definition is LibraryConstant {
    if (!isConstant(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Constant}`);
    }
}

export function assertIsFunction(definition: TLibraryDefinition | undefined): asserts definition is LibraryFunction {
    if (!isFunction(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Function}`);
    }
}

export function assertIsType(definition: TLibraryDefinition | undefined): asserts definition is LibraryType {
    if (!isType(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Type}`);
    }
}

export function constantDefinition(
    label: string,
    description: string,
    asType: Type.TPowerQueryType,
    completionItemKind: CompletionItemKind,
): LibraryConstant {
    return {
        kind: LibraryDefinitionKind.Constant,
        asPowerQueryType: asType,
        completionItemKind,
        description,
        label,
    };
}

export function externalTypeResolver(libraryDefinitions: LibraryDefinitions): ExternalType.TExternalTypeResolverFn {
    return (request: ExternalType.TExternalTypeRequest): Type.TPowerQueryType | undefined =>
        getDefinition(libraryDefinitions, request.identifierLiteral)?.asPowerQueryType;
}

export function functionDefinition(
    label: string,
    description: string,
    asType: Type.TPowerQueryType,
    completionItemKind: CompletionItemKind,
    parameters: ReadonlyArray<LibraryParameter>,
): LibraryFunction {
    return {
        kind: LibraryDefinitionKind.Function,
        asPowerQueryType: asType,
        completionItemKind,
        description,
        label,
        parameters,
    };
}

export function getDefinition(
    libraryDefinitions: LibraryDefinitions,
    identifierLiteral: string,
): TLibraryDefinition | undefined {
    const staticDefinition: TLibraryDefinition | undefined =
        libraryDefinitions.staticLibraryDefinitions.get(identifierLiteral);

    if (staticDefinition) {
        return staticDefinition;
    }

    const dynamicDefinition: TLibraryDefinition | undefined = libraryDefinitions
        .dynamicLibraryDefinitions()
        .get(identifierLiteral);

    return dynamicDefinition;
}

export function getKeys(libraryDefinitions: LibraryDefinitions): ReadonlyArray<string> {
    return [
        ...libraryDefinitions.staticLibraryDefinitions.keys(),
        ...libraryDefinitions.dynamicLibraryDefinitions().keys(),
    ];
}

export function hasDefinition(libraryDefinitions: LibraryDefinitions, key: string): boolean {
    return getDefinition(libraryDefinitions, key) !== undefined;
}

export function isConstant(definition: TLibraryDefinition | undefined): definition is LibraryConstant {
    return definition?.kind === LibraryDefinitionKind.Constant;
}

export function isFunction(definition: TLibraryDefinition | undefined): definition is LibraryFunction {
    return definition?.kind === LibraryDefinitionKind.Function;
}

export function isType(definition: TLibraryDefinition | undefined): definition is LibraryType {
    return definition?.kind === LibraryDefinitionKind.Type;
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
