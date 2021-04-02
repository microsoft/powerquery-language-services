// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ParameterInformation, SignatureInformation } from "vscode-languageserver-types";
import {
    LibraryConstant,
    LibraryDefinitionKind,
    LibraryFunction,
    LibraryParameter,
    LibraryType,
    TLibraryDefinition,
} from "./library";

export function assertAsConstant(maybeDefinition: TLibraryDefinition | undefined): LibraryConstant {
    assertIsConstant(maybeDefinition);
    return maybeDefinition;
}

export function assertAsFunction(maybeDefinition: TLibraryDefinition | undefined): LibraryFunction {
    assertIsFunction(maybeDefinition);
    return maybeDefinition;
}

export function assertAsType(maybeDefinition: TLibraryDefinition | undefined): LibraryType {
    assertIsType(maybeDefinition);
    return maybeDefinition;
}

export function assertIsConstant(
    maybeDefinition: TLibraryDefinition | undefined,
): asserts maybeDefinition is LibraryConstant {
    if (!isConstant(maybeDefinition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Constant}`);
    }
}

export function assertIsFunction(
    maybeDefinition: TLibraryDefinition | undefined,
): asserts maybeDefinition is LibraryFunction {
    if (!isFunction(maybeDefinition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Function}`);
    }
}

export function assertIsType(maybeDefinition: TLibraryDefinition | undefined): asserts maybeDefinition is LibraryType {
    if (!isType(maybeDefinition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Type}`);
    }
}

export function createConstantDefinition(
    asType: PQP.Language.Type.PowerQueryType,
    description: string,
    label: string,
    primitiveType: PQP.Language.Type.TPrimitiveType,
): LibraryConstant {
    return {
        kind: LibraryDefinitionKind.Constant,
        asType,
        description,
        label,
        primitiveType,
    };
}

export function createFunctionDefinition(
    asType: PQP.Language.Type.PowerQueryType,
    description: string,
    label: string,
    primitiveType: PQP.Language.Type.TPrimitiveType,
    parameters: ReadonlyArray<LibraryParameter>,
): LibraryFunction {
    return {
        kind: LibraryDefinitionKind.Function,
        asType,
        description,
        label,
        primitiveType,
        parameters,
    };
}

export function isConstant(maybeDefinition: TLibraryDefinition | undefined): maybeDefinition is LibraryConstant {
    return maybeDefinition?.kind === LibraryDefinitionKind.Constant;
}

export function isFunction(maybeDefinition: TLibraryDefinition | undefined): maybeDefinition is LibraryFunction {
    return maybeDefinition?.kind === LibraryDefinitionKind.Function;
}

export function isType(maybeDefinition: TLibraryDefinition | undefined): maybeDefinition is LibraryType {
    return maybeDefinition?.kind === LibraryDefinitionKind.Type;
}

export function createSignatureInformation(libraryFunctionSignature: LibraryFunction): SignatureInformation {
    return {
        label: libraryFunctionSignature.label,
        documentation: libraryFunctionSignature.description,
        parameters: libraryFunctionSignature.parameters.map(createParameterInformation),
    };
}

export function createParameterInformation(libraryParameter: LibraryParameter): ParameterInformation {
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
            throw PQP.Assert.isNever(kind);
    }
}
