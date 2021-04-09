// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { AutocompleteItem } from "./autocompleteItem";

import { Autocomplete } from "./commonTypes";

export function keys(autocomplete: Autocomplete): ReadonlyArray<string> {
    let result: string[] = [];

    if (PQP.ResultUtils.isOk(autocomplete.triedFieldAccess) && autocomplete.triedFieldAccess.value !== undefined) {
        result = result.concat(
            autocomplete.triedFieldAccess.value.autocompleteItems.map(
                (autocompleteItem: AutocompleteItem) => autocompleteItem.label,
            ),
        );
    }

    if (PQP.ResultUtils.isOk(autocomplete.triedKeyword)) {
        result = result.concat(
            autocomplete.triedKeyword.value.map((autocompleteItem: AutocompleteItem) => autocompleteItem.label),
        );
    }

    if (PQP.ResultUtils.isOk(autocomplete.triedPrimitiveType) && autocomplete.triedPrimitiveType.value !== undefined) {
        result = result.concat(
            autocomplete.triedPrimitiveType.value.map((autocompleteItem: AutocompleteItem) => autocompleteItem.label),
        );
    }

    return result;
}
