// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { TMaybeActiveNode } from "../activeNode";
import { InspectionSettings } from "../settings";
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

export function autocomplete<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: InspectionSettings,
    parseState: S,
    typeCache: TypeCache,
    maybeActiveNode: TMaybeActiveNode,
    maybeParseError: PQP.Parser.ParseError.ParseError<S> | undefined,
): Autocomplete {
    const nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;
    const leafNodeIds: ReadonlyArray<number> = parseState.contextState.leafNodeIds;

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
        leafNodeIds,
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
