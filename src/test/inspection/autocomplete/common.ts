// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from "../../../powerquery-language-services";

export type AbridgedAutocompleteItem = Pick<Inspection.AutocompleteItem, "label" | "jaroWinklerScore">;

export function createAbridgedAutocompleteItem(
    autocompleteItem: Inspection.AutocompleteItem,
): AbridgedAutocompleteItem {
    return {
        label: autocompleteItem.label,
        jaroWinklerScore: autocompleteItem.jaroWinklerScore,
    };
}

export function createAbridgedAutocompleteItems(
    autocompleteItems: ReadonlyArray<Inspection.AutocompleteItem>,
): ReadonlyArray<AbridgedAutocompleteItem> {
    return autocompleteItems.map(createAbridgedAutocompleteItem);
}

export function createTweakedAbridgedAutocompleteItems(
    labels: ReadonlyArray<string>,
    jaroWinklerValues?: Map<string, number>,
): ReadonlyArray<AbridgedAutocompleteItem> {
    return labels.map((kind: string) => ({
        label: kind,
        jaroWinklerScore: jaroWinklerValues?.get(kind) ?? 1,
    }));
}
