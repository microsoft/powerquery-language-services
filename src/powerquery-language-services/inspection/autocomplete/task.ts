// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { InspectionSettings } from "../../inspectionSettings";

import { TMaybeActiveNode } from "../activeNode";
import { TypeCache } from "../typeCache";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
import { tryAutocompleteLanguageConstant } from "./autocompleteLanguageConstant";
import { tryAutocompletePrimitiveType } from "./autocompletePrimitiveType";
import { createTrailingToken } from "./common";
import {
    Autocomplete,
    TrailingToken,
    TriedAutocompleteFieldAccess,
    TriedAutocompleteKeyword,
    TriedAutocompleteLanguageConstant,
    TriedAutocompletePrimitiveType,
} from "./commonTypes";

export function autocomplete(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    typeCache: TypeCache,
    maybeActiveNode: TMaybeActiveNode,
    maybeParseError: PQP.Parser.ParseError.ParseError | undefined,
): Autocomplete {
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;

    let maybeTrailingToken: TrailingToken | undefined;
    if (maybeParseError !== undefined) {
        const maybeParseErrorToken: PQP.Language.Token.Token | undefined = PQP.Parser.ParseError.maybeTokenFrom(
            maybeParseError.innerError,
        );
        if (maybeParseErrorToken !== undefined) {
            maybeTrailingToken = createTrailingToken(maybeActiveNode.position, maybeParseErrorToken);
        }
    }

    const triedFieldAccess: TriedAutocompleteFieldAccess = tryAutocompleteFieldAccess(
        settings,
        parseState,
        maybeActiveNode,
        typeCache,
    );

    const triedKeyword: TriedAutocompleteKeyword = tryAutocompleteKeyword(
        settings,
        nodeIdMapCollection,
        maybeActiveNode,
        maybeTrailingToken,
    );

    const triedLanguageConstant: TriedAutocompleteLanguageConstant = tryAutocompleteLanguageConstant(
        settings,
        maybeActiveNode,
    );

    const triedPrimitiveType: TriedAutocompletePrimitiveType = tryAutocompletePrimitiveType(
        settings,
        maybeActiveNode,
        maybeTrailingToken,
    );

    return {
        triedFieldAccess,
        triedKeyword,
        triedLanguageConstant,
        triedPrimitiveType,
    };
}
