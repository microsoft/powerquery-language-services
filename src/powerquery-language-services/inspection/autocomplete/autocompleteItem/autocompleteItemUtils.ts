// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { calculateJaroWinkler } from "../../jaroWinkler";
import { AutocompleteItem } from "./autocompleteItem";

export function create(
    key: string,
    jaroWinklerScore: number,
    powerQueryType: PQP.Language.Type.PowerQueryType,
): AutocompleteItem {
    return {
        key,
        jaroWinklerScore,
        powerQueryType,
    };
}

export function createFromJaroWinkler(
    key: string,
    other: string,
    powerQueryType: PQP.Language.Type.PowerQueryType,
): AutocompleteItem {
    return create(key, calculateJaroWinkler(key, other), powerQueryType);
}

export function createFromKeywordKind(key: PQP.Language.Keyword.KeywordKind, maybeOther?: string): AutocompleteItem {
    return maybeOther
        ? createFromJaroWinkler(key, maybeOther, PQP.Language.Type.NotApplicableInstance)
        : create(key, 1, PQP.Language.Type.NotApplicableInstance);
}
