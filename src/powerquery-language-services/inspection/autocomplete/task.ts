// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import {
    Autocomplete,
    TriedAutocompleteFieldAccess,
    TriedAutocompleteKeyword,
    TriedAutocompleteLanguageConstant,
    TriedAutocompletePrimitiveType,
} from "./commonTypes";
import { AutocompleteTraceConstant } from "../..";
import { createTrailingToken } from "./trailingTokenUtils";
import { InspectionSettings } from "../../inspectionSettings";
import { TActiveNode } from "../activeNode";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
import { tryAutocompleteLanguageConstant } from "./autocompleteLanguageConstant";
import { tryAutocompletePrimitiveType } from "./autocompletePrimitiveType";
import { TypeCache } from "../typeCache";
import { TrailingToken } from "./trailingToken";

// Given some Position and ParseState, return autocomplete suggestions.
export async function autocomplete(
    settings: InspectionSettings,
    parseState: PQP.Parser.ParseState,
    typeCache: TypeCache,
    activeNode: TActiveNode,
    parseError: PQP.Parser.ParseError.ParseError | undefined,
): Promise<Autocomplete> {
    const trace: Trace = settings.traceManager.entry(
        AutocompleteTraceConstant.Autocomplete,
        autocomplete.name,
        settings.initialCorrelationId,
    );

    const updatedSettings: InspectionSettings = {
        ...settings,
        initialCorrelationId: trace.id,
    };

    const nodeIdMapCollection: NodeIdMap.Collection = parseState.contextState.nodeIdMapCollection;

    let trailingToken: TrailingToken | undefined;

    if (parseError !== undefined) {
        const parseErrorToken: PQP.Language.Token.Token | undefined = PQP.Parser.ParseError.tokenFrom(
            parseError.innerError,
        );

        if (parseErrorToken !== undefined) {
            trailingToken = createTrailingToken(activeNode.position, parseErrorToken);
        }
    }

    const triedFieldAccess: TriedAutocompleteFieldAccess = await tryAutocompleteFieldAccess(
        updatedSettings,
        parseState,
        activeNode,
        typeCache,
    );

    const triedKeyword: TriedAutocompleteKeyword = await tryAutocompleteKeyword(
        updatedSettings,
        nodeIdMapCollection,
        activeNode,
        trailingToken,
    );

    const triedLanguageConstant: TriedAutocompleteLanguageConstant = tryAutocompleteLanguageConstant(
        updatedSettings,
        nodeIdMapCollection,
        activeNode,
        trailingToken,
    );

    const triedPrimitiveType: TriedAutocompletePrimitiveType = tryAutocompletePrimitiveType(
        updatedSettings,
        nodeIdMapCollection,
        activeNode,
        trailingToken,
    );

    trace.exit();

    return {
        triedFieldAccess,
        triedKeyword,
        triedLanguageConstant,
        triedPrimitiveType,
    };
}
