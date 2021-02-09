// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import {
    LibraryConstant,
    LibraryConstructor,
    LibraryDefinitionKind,
    LibraryFunction,
    LibraryType,
    TLibraryDefinition,
    LibraryFunctionSignature,
} from "./library";

export function assertAsConstant(definition: TLibraryDefinition): LibraryConstant {
    assertIsConstant(definition);
    return definition;
}

export function assertAsConstructor(definition: TLibraryDefinition): LibraryConstructor {
    assertIsConstructor(definition);
    return definition;
}
export function assertAsFunction(definition: TLibraryDefinition): LibraryFunction {
    assertIsFunction(definition);
    return definition;
}

export function assertAsType(definition: TLibraryDefinition): LibraryType {
    assertIsType(definition);
    return definition;
}

export function assertIsConstant(definition: TLibraryDefinition): asserts definition is LibraryConstant {
    if (!isConstant(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Constant}`);
    }
}

export function assertIsConstructor(definition: TLibraryDefinition): asserts definition is LibraryConstructor {
    if (!isConstructor(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Constructor}`);
    }
}
export function assertIsFunction(definition: TLibraryDefinition): asserts definition is LibraryFunction {
    if (!isFunction(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Function}`);
    }
}

export function assertIsType(definition: TLibraryDefinition): asserts definition is LibraryType {
    if (!isType(definition)) {
        throw new Error(`expected definition to be ${LibraryDefinitionKind.Type}`);
    }
}

export function createConstantDefinition(
    asType: PQP.Language.Type.TType,
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

export function createConstructorDefinition(
    asType: PQP.Language.Type.TType,
    description: string,
    label: string,
    primitiveType: PQP.Language.Type.TPrimitiveType,
    signatures: ReadonlyArray<LibraryFunctionSignature>,
): LibraryConstructor {
    return {
        kind: LibraryDefinitionKind.Constructor,
        asType,
        description,
        label,
        primitiveType,
        signatures,
    };
}

export function createFunctionDefinition(
    asType: PQP.Language.Type.TType,
    description: string,
    label: string,
    primitiveType: PQP.Language.Type.TPrimitiveType,
    signatures: ReadonlyArray<LibraryFunctionSignature>,
): LibraryFunction {
    return {
        kind: LibraryDefinitionKind.Function,
        asType,
        description,
        label,
        primitiveType,
        signatures,
    };
}

export function createLibraryType(
    asType: PQP.Language.Type.TType,
    description: string,
    label: string,
    primitiveType: PQP.Language.Type.TPrimitiveType,
    signatures: ReadonlyArray<LibraryFunctionSignature>,
): LibraryFunction {
    return {
        kind: LibraryDefinitionKind.Function,
        asType,
        description,
        label,
        primitiveType,
        signatures,
    };
}

export function isConstant(definition: TLibraryDefinition): definition is LibraryConstant {
    return definition.kind === LibraryDefinitionKind.Constant;
}

export function isConstructor(definition: TLibraryDefinition): definition is LibraryConstructor {
    return definition.kind === LibraryDefinitionKind.Constructor;
}
export function isFunction(definition: TLibraryDefinition): definition is LibraryFunction {
    return definition.kind === LibraryDefinitionKind.Function;
}

export function isType(definition: TLibraryDefinition): definition is LibraryType {
    return definition.kind === LibraryDefinitionKind.Type;
}

export function nameOf(kind: LibraryDefinitionKind): string {
    switch (kind) {
        case LibraryDefinitionKind.Constructor:
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
