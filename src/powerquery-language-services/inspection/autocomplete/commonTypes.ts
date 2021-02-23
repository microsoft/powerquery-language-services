// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export type TriedAutocompleteFieldAccess = PQP.Result<AutocompleteFieldAccess | undefined, PQP.CommonError.CommonError>;

export type TriedAutocompleteKeyword = PQP.Result<AutocompleteKeyword, PQP.CommonError.CommonError>;

export type TriedAutocompleteLanguageConstant = PQP.Result<
    AutocompleteLanguageConstant | undefined,
    PQP.CommonError.CommonError
>;

export type TriedAutocompletePrimitiveType = PQP.Result<AutocompletePrimitiveType, PQP.CommonError.CommonError>;

export type AutocompleteKeyword = ReadonlyArray<PQP.Language.Keyword.KeywordKind>;

export type AutocompleteLanguageConstant = PQP.Language.Constant.LanguageConstantKind;

export type AutocompletePrimitiveType = ReadonlyArray<PQP.Language.Constant.PrimitiveTypeConstantKind>;

export interface Autocomplete {
    readonly triedFieldAccess: TriedAutocompleteFieldAccess;
    readonly triedKeyword: TriedAutocompleteKeyword;
    readonly triedLanguageConstant: TriedAutocompleteLanguageConstant;
    readonly triedPrimitiveType: TriedAutocompletePrimitiveType;
}

export interface AutocompleteItem {
    readonly key: string;
    readonly type: PQP.Language.Type.TType;
}

export interface AutocompleteFieldAccess {
    readonly field: PQP.Parser.TXorNode;
    readonly fieldType: PQP.Language.Type.TType;
    readonly inspectedFieldAccess: InspectedFieldAccess;
    readonly autocompleteItems: ReadonlyArray<AutocompleteItem>;
}

export interface InspectedFieldAccess {
    readonly isAutocompleteAllowed: boolean;
    readonly maybeIdentifierUnderPosition: string | undefined;
    readonly fieldNames: ReadonlyArray<string>;
}

export interface TrailingToken extends PQP.Language.Token.Token {
    readonly isInOrOnPosition: boolean;
}
