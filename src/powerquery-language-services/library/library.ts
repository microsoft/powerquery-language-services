// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export type Library = Map<string, TLibraryDefinition>;

export interface Module {
    readonly name: string;
    readonly maybeVersion: string | undefined;
    readonly visibility: Visibility;
}

export interface Visibility {
    readonly isInternal: boolean;
    readonly isSdkOnly: boolean;
    readonly isSdkVisible: boolean;
}

// ----------------------------------------
// ---------- ILibraryDefinition ----------
// ----------------------------------------

export type TLibraryDefinition = LibraryConstant | LibraryConstructor | LibraryFunction | LibraryType;

export const enum LibraryDefinitionKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type",
}

export interface ILibraryDefinition {
    readonly description: string;
    readonly label: string;
    readonly kind: LibraryDefinitionKind;
    readonly module: Module;
    readonly primitiveType: PQP.Language.Type.TPrimitiveType;
}

export interface LibraryConstant extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Constant;
}

export interface LibraryConstructor extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Constructor;
}

export interface LibraryFunction extends ILibraryDefinition, PQP.Language.Type.FunctionSignature {
    readonly kind: LibraryDefinitionKind.Function;
    readonly signatures: ReadonlyArray<LibraryFunctionSignature>;
}

export interface LibraryFunctionSignature {
    readonly label: string;
    readonly parameters: ReadonlyArray<LibraryParameter>;
}

export interface LibraryParameter extends PQP.Language.Type.FunctionParameter {
    readonly maybeDocumentation: string | undefined;
}

export interface LibraryType extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Type;
}
