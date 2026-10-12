// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResultUtils } from "@microsoft/powerquery-parser";

import { Autocomplete } from "./commonTypes";
import { AutocompleteItem } from "./autocompleteItem";

export function keys(autocomplete: Autocomplete): ReadonlyArray<string> {
    const result: string[] = [];

    if (ResultUtils.isOk(autocomplete.triedFieldAccess) && autocomplete.triedFieldAccess.value !== undefined) {
        appendKeys(autocomplete.triedFieldAccess.value.autocompleteItems, result);
    }

    if (ResultUtils.isOk(autocomplete.triedKeyword)) {
        appendKeys(autocomplete.triedKeyword.value, result);
    }

    if (ResultUtils.isOk(autocomplete.triedPrimitiveType) && autocomplete.triedPrimitiveType.value !== undefined) {
        appendKeys(autocomplete.triedPrimitiveType.value, result);
    }

    return result;
}

function appendKeys(autocompleteItems: ReadonlyArray<AutocompleteItem>, result: string[]): void {
    // Preserve map's initial length and sparse slots if label getters mutate the input.
    const length: number = autocompleteItems.length;

    for (let index: number = 0; index < length; index += 1) {
        if (index in autocompleteItems) {
            result.push(autocompleteItems[index].label);
        } else {
            result.length += 1;
        }
    }
}
