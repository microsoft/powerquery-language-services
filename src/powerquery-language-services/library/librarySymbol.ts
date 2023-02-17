// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// We perform an introspection query using Power Query to generate these symbols,
// which then need to be translated to the PQLS library definitions.

export interface LibrarySymbol {
    readonly name: string;
    readonly documentation?: LibrarySymbolDocumentation;
    readonly functionParameters?: ReadonlyArray<LibrarySymbolFunctionParameter>;
    readonly completionItemKind: number;
    readonly isDataSource: boolean;
    readonly type: string;
}

export interface LibrarySymbolDocumentation {
    readonly description?: string;
    readonly longDescription?: string;
}

export interface LibrarySymbolFunctionParameter {
    readonly name: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly isNullable: boolean;
    readonly caption?: string;
    readonly description?: string;
    readonly sampleValues?: ReadonlyArray<string | number>;
    readonly allowedValues?: ReadonlyArray<string | number>;
    readonly defaultValue?: string | number;
    readonly fields?: ReadonlyArray<LibrarySymbolRecordField>;
    readonly enumNames?: string[];
    readonly enumCaptions?: string[];
}

export interface LibrarySymbolRecordField {
    readonly name: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly caption?: string;
    readonly description?: string;
}
