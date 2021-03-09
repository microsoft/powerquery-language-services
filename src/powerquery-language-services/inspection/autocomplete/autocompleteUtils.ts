// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Autocomplete, AutocompleteItem } from "./commonTypes";

export function keys(autocomplete: Autocomplete): ReadonlyArray<string> {
    let result: string[] = [];

    if (PQP.ResultUtils.isOk(autocomplete.triedFieldAccess) && autocomplete.triedFieldAccess.value !== undefined) {
        result = result.concat(
            autocomplete.triedFieldAccess.value.autocompleteItems.map(
                (autocompleteItem: AutocompleteItem) => autocompleteItem.key,
            ),
        );
    }

    if (PQP.ResultUtils.isOk(autocomplete.triedKeyword)) {
        result = result.concat(autocomplete.triedKeyword.value);
    }

    if (PQP.ResultUtils.isOk(autocomplete.triedPrimitiveType) && autocomplete.triedPrimitiveType.value !== undefined) {
        result = result.concat(autocomplete.triedPrimitiveType.value);
    }

    return result;
}
