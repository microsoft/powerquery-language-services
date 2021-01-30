// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export type Library = Map<string, LibraryDefinition>;

export const enum LibraryDefinitionKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type",
}

export interface Module {
    readonly name: string;
    readonly version: string | undefined;
    readonly visibility: Visibility;
}

export interface LibraryDefinition {
    readonly label: string;
    readonly kind: LibraryDefinitionKind;
    readonly primitiveType: PQP.Language.Type.TType;
    readonly summary: string;
    readonly module: Module;
    readonly signatures: ReadonlyArray<Signature>;
}

export interface Signature {
    readonly label: string;
    readonly parameters: ReadonlyArray<Parameter>;
}

export interface Parameter {
    readonly documentation: string | undefined | null;
    readonly label: string;
    readonly signatureLabelOffset: number;
    readonly signatureLabelEnd: number;
    readonly type: PQP.Language.Type.TType;
}

export interface Visibility {
    readonly isInternal: boolean;
    readonly isSdkOnly: boolean;
    readonly isSdkVisible: boolean;
}
