// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export type LibraryDefinitions = ReadonlyMap<string, TLibraryDefinition>;

export type TLibraryDefinition = LibraryConstant | LibraryConstructor | LibraryFunction | LibraryType;

export const enum LibraryDefinitionKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type",
}

export interface ILibrary {
    readonly externalTypeResolver: PQP.Language.ExternalType.TExternalTypeResolverFn;
    readonly libraryDefinitions: LibraryDefinitions;
}

export interface ILibraryDefinition {
    readonly asType: PQP.Language.Type.TType;
    readonly description: string;
    readonly kind: LibraryDefinitionKind;
    readonly label: string;
    readonly primitiveType: PQP.Language.Type.TPrimitiveType;
}

export interface LibraryConstant extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Constant;
}

export interface LibraryConstructor extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Constructor;
    readonly signatures: ReadonlyArray<LibraryFunctionSignature>;
}

export interface LibraryFunction extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Function;
    readonly signatures: ReadonlyArray<LibraryFunctionSignature>;
}

export interface LibraryFunctionSignature {
    readonly label: string;
    readonly parameters: ReadonlyArray<LibraryParameter>;
}

export interface LibraryParameter {
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly label: string;
    readonly maybeDocumentation: string | undefined;
    readonly typeKind: PQP.Language.Type.TypeKind;
    readonly signatureLabelEnd: number;
    readonly signatureLabelOffset: number;
}

export interface LibraryType extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Type;
}
