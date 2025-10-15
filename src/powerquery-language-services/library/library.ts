// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type CompletionItemKind } from "vscode-languageserver-types";
import { type Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ExternalType } from "../externalType";

export type TLibraryDefinition = LibraryConstant | LibraryFunction | LibraryType;

export enum LibraryDefinitionKind {
    Constant = "Constant",
    Function = "Function",
    Type = "Type",
}

export interface ILibrary {
    readonly externalTypeResolver: ExternalType.TExternalTypeResolverFn;
    readonly libraryDefinitions: LibraryDefinitions;
}

export interface ILibraryDefinition {
    readonly asPowerQueryType: Type.TPowerQueryType;
    readonly completionItemKind: CompletionItemKind;
    readonly description: string;
    readonly kind: LibraryDefinitionKind;
    readonly label: string;
}

export interface LibraryDefinitions {
    /** Used by the host to inject library definitions,
     * either because they're dynamically generated or if they prefer lazy evaluation. */
    readonly dynamicLibraryDefinitions: () => ReadonlyMap<string, TLibraryDefinition>;
    /** Represents an unchanging standard library. It's expected to never change. */
    readonly staticLibraryDefinitions: ReadonlyMap<string, TLibraryDefinition>;
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
    readonly documentation: string | undefined;
    readonly typeKind: Type.TypeKind;
}

export interface LibraryType extends ILibraryDefinition {
    readonly kind: LibraryDefinitionKind.Type;
}

export const NoOpLibrary: ILibrary = {
    externalTypeResolver: ExternalType.noOpExternalTypeResolver,
    libraryDefinitions: {
        dynamicLibraryDefinitions: () => new Map<string, TLibraryDefinition>(),
        staticLibraryDefinitions: new Map<string, TLibraryDefinition>(),
    },
};
