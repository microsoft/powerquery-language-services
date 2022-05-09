// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    Autocomplete,
    TrailingToken,
    TriedAutocompleteFieldAccess,
    TriedAutocompleteKeyword,
    TriedAutocompleteLanguageConstant,
    TriedAutocompletePrimitiveType,
} from "./commonTypes";
import { AutocompleteTraceConstant } from "../..";
import { createTrailingToken } from "./common";
import { InspectionSettings } from "../../inspectionSettings";
import { TMaybeActiveNode } from "../activeNode";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
import { tryAutocompleteLanguageConstant } from "./autocompleteLanguageConstant";
import { tryAutocompletePrimitiveType } from "./autocompletePrimitiveType";
import { TypeCache } from "../typeCache";

// Given some Position and ParseState, return autocomplete suggestions.
export async function autocomplete(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    typeCache: TypeCache,
    maybeActiveNode: TMaybeActiveNode,
    maybeParseError: PQP.Parser.ParseError.ParseError | undefined,
): Promise<Autocomplete> {
    const trace: Trace = settings.traceManager.entry(
        AutocompleteTraceConstant.Autocomplete,
        autocomplete.name,
        settings.maybeInitialCorrelationId,
    );

    const updatedSettings: InspectionSettings = {
        ...settings,
        maybeInitialCorrelationId: trace.id,
    };

    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;

    let maybeTrailingToken: TrailingToken | undefined;

    if (maybeParseError !== undefined) {
        const maybeParseErrorToken: PQP.Language.Token.Token | undefined = PQP.Parser.ParseError.maybeTokenFrom(
            maybeParseError.innerError,
        );

        if (maybeParseErrorToken !== undefined) {
            maybeTrailingToken = createTrailingToken(maybeActiveNode.position, maybeParseErrorToken);
        }
    }

    const triedFieldAccess: TriedAutocompleteFieldAccess = await tryAutocompleteFieldAccess(
        updatedSettings,
        parseState,
        maybeActiveNode,
        typeCache,
    );

    const triedKeyword: TriedAutocompleteKeyword = await tryAutocompleteKeyword(
        updatedSettings,
        nodeIdMapCollection,
        maybeActiveNode,
        maybeTrailingToken,
    );

    const triedLanguageConstant: TriedAutocompleteLanguageConstant = tryAutocompleteLanguageConstant(
        updatedSettings,
        maybeActiveNode,
    );

    const triedPrimitiveType: TriedAutocompletePrimitiveType = tryAutocompletePrimitiveType(
        updatedSettings,
        maybeActiveNode,
        maybeTrailingToken,
    );

    trace.exit();

    return {
        triedFieldAccess,
        triedKeyword,
        triedLanguageConstant,
        triedPrimitiveType,
    };
}
