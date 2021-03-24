// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { ExternalType } from "../inspection";

export type LibraryDefinitions = ReadonlyMap<string, TLibraryDefinition>;

export type TLibraryDefinition = LibraryConstant | LibraryFunction | LibraryType;

export const enum LibraryDefinitionKind {
    Constant = "Constant",
    Function = "Function",
    Type = "Type",
}

export interface ILibrary {
    readonly externalTypeResolver: ExternalType.TExternalTypeResolverFn;
    readonly libraryDefinitions: LibraryDefinitions;
}

export interface ILibraryDefinition {
    readonly asType: PQP.Language.Type.PqType;
    readonly description: string;
    readonly kind: LibraryDefinitionKind;
    readonly label: string;
    readonly primitiveType: PQP.Language.Type.TPrimitiveType;
}

export interface LibraryConstant extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Constant;
}

export interface LibraryFunction extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Function;
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
