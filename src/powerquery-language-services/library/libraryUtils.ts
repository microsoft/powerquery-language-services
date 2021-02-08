// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import {
    ILibrary,
    LibraryConstant,
    LibraryConstructor,
    LibraryDefinitionKind,
    LibraryFunction,
    LibraryType,
    TLibraryDefinition,
} from "./library";

// A null/no-op library for when one is required but shouldn't resolve anything, eg. for test mocks.
export const NoOpLibrary: ILibrary = {
    externalTypeResolver: PQP.Language.ExternalType.noOpExternalTypeResolver,
    libraryDefinitions: new Map(),
};

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
