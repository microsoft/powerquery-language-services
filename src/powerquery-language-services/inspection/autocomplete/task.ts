// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { type NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { type Trace } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { type Autocomplete } from "./commonTypes";
import { AutocompleteTraceConstant } from "../..";
import { createTrailingToken } from "./trailingTokenUtils";
import { type InspectionSettings } from "../../inspectionSettings";
import { type TActiveNode } from "../activeNode";
import { type TrailingToken } from "./trailingToken";
import { tryAutocompleteFieldAccess } from "./autocompleteFieldAccess";
import { tryAutocompleteKeyword } from "./autocompleteKeyword/autocompleteKeyword";
import { tryAutocompleteLanguageConstant } from "./autocompleteLanguageConstant";
import { tryAutocompletePrimitiveType } from "./autocompletePrimitiveType";
import { type TypeCache } from "../typeCache";

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

    trace.exit();

    return {
        triedFieldAccess: await tryAutocompleteFieldAccess(updatedSettings, parseState, activeNode, typeCache),
        triedKeyword: await tryAutocompleteKeyword(updatedSettings, nodeIdMapCollection, activeNode, trailingToken),
        triedLanguageConstant: tryAutocompleteLanguageConstant(
            updatedSettings,
            nodeIdMapCollection,
            activeNode,
            trailingToken,
        ),
        triedPrimitiveType: tryAutocompletePrimitiveType(
            updatedSettings,
            nodeIdMapCollection,
            activeNode,
            trailingToken,
        ),
    };
}
