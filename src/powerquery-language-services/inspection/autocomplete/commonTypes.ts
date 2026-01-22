// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type * as PQP from "@microsoft/powerquery-parser";
import { type Range } from "vscode-languageserver-types";
import { type TXorNode } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { type AutocompleteItem } from "./autocompleteItem";

export type TriedAutocompleteFieldAccess = PQP.Result<AutocompleteFieldAccess | undefined, PQP.CommonError.CommonError>;

export type TriedAutocompleteKeyword = PQP.Result<ReadonlyArray<AutocompleteItem>, PQP.CommonError.CommonError>;

export type TriedAutocompleteLanguageConstant = PQP.Result<
    ReadonlyArray<AutocompleteItem>,
    PQP.CommonError.CommonError
>;

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

// Given `[this has a space = 1][this| has a space`
//  - textUnderPosition will be `this`
//  - textEditRange will be the range of `this`.
//
// This is because GeneralizedIdentifiers consume tokens until it reaches a token for either: ",", "]", "="
// Therefore take the scenario where a customer has a file `let foo = [thing = 1] in ...`,
// then they add a field selection which triggers an autocomplete for: `let foo = [thing = 1][f| in ...`
// This creates a GeneralizedIdentifier of `f in ...`.
//
// It's safer to assume that the user wants to autocomplete the token they're under,
// rather than the whole GeneralizedIdentifier.
export interface InspectedFieldAccess {
    readonly fieldNames: ReadonlyArray<string>;
    readonly isAutocompleteAllowed: boolean;
    readonly textEditRange: Range | undefined;
    readonly textUnderPosition: string | undefined;
}
