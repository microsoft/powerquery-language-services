// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import { AutocompleteItem } from "./autocompleteItem";

export type TriedAutocompleteFieldAccess = PQP.Result<AutocompleteFieldAccess | undefined, PQP.CommonError.CommonError>;

export type TriedAutocompleteKeyword = PQP.Result<ReadonlyArray<AutocompleteItem>, PQP.CommonError.CommonError>;

export type TriedAutocompleteLanguageConstant = PQP.Result<AutocompleteItem | undefined, PQP.CommonError.CommonError>;

export type TriedAutocompletePrimitiveType = PQP.Result<ReadonlyArray<AutocompleteItem>, PQP.CommonError.CommonError>;

export interface Autocomplete {
    readonly triedFieldAccess: TriedAutocompleteFieldAccess;
    readonly triedKeyword: TriedAutocompleteKeyword;
    readonly triedLanguageConstant: TriedAutocompleteLanguageConstant;
    readonly triedPrimitiveType: TriedAutocompletePrimitiveType;
}

export interface AutocompleteFieldAccess {
    readonly field: TXorNode;
    readonly fieldType: Type.TPowerQueryType;
    readonly inspectedFieldAccess: InspectedFieldAccess;
    readonly autocompleteItems: ReadonlyArray<AutocompleteItem>;
}

export interface InspectedFieldAccess {
    readonly isAutocompleteAllowed: boolean;
    readonly identifierUnderPosition: Ast.GeneralizedIdentifier | undefined;
    readonly fieldNames: ReadonlyArray<string>;
}

// A ParseError includes the token it failed to parse.
// This is that token plus a flag for where it is in relation to a Position.
export interface TrailingToken extends PQP.Language.Token.Token {
    readonly isInOrOnPosition: boolean;
}
