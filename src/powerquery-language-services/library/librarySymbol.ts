// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// We perform an introspection query using Power Query to generate these symbols,
// which then need to be translated to the PQLS library definitions.

export interface LibrarySymbol {
    readonly name: string;
    readonly documentation: LibrarySymbolDocumentation | null | undefined;
    readonly functionParameters: ReadonlyArray<LibrarySymbolFunctionParameter> | null | undefined;
    readonly completionItemKind: number;
    readonly isDataSource: boolean;
    readonly type: string;
}

export interface LibrarySymbolDocumentation {
    readonly description: string | null | undefined;
    readonly longDescription: string | null | undefined;
}

export interface LibrarySymbolFunctionParameter {
    readonly name: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly isNullable: boolean;
    readonly caption: string | null | undefined;
    readonly description: string | null | undefined;
    readonly sampleValues: ReadonlyArray<string | number> | null | undefined;
    readonly allowedValues: ReadonlyArray<string | number> | null | undefined;
    readonly defaultValue: string | number | null | undefined;
    readonly fields: ReadonlyArray<LibrarySymbolRecordField> | null | undefined;
    readonly enumNames: ReadonlyArray<string> | null | undefined;
    readonly enumCaptions: ReadonlyArray<string | null> | null | undefined;
}

export interface LibrarySymbolRecordField {
    readonly name: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly caption: string | null | undefined;
    readonly description: string | null | undefined;
}
