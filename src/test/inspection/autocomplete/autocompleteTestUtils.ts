// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

export interface AbridgedAutocompleteItem {
    readonly label: string;
    readonly isTextEdit: boolean;
}

export async function assertAutocomplete(textWithPipe: string): Promise<Inspection.Autocomplete> {
    return (await TestUtils.assertInspected(TestConstants.DefaultInspectionSettings, textWithPipe)).autocomplete;
}

export async function assertAutocompleteItems(
    textWithPipe: string,
    autocompleteItemSelector: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    return autocompleteItemSelector(await assertAutocomplete(textWithPipe));
}

export async function expectAbridgedAutocompleteItems(
    textWithPipe: string,
    autocompleteItemSelector: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
    expected?: ReadonlyArray<AbridgedAutocompleteItem>,
): Promise<ReadonlyArray<AbridgedAutocompleteItem>> {
    const actual: ReadonlyArray<AbridgedAutocompleteItem> = (
        await assertAutocompleteItems(textWithPipe, autocompleteItemSelector)
    ).map((value: Inspection.AutocompleteItem) => ({
        label: value.label,
        isTextEdit: value.textEdit !== undefined,
    }));

    if (expected !== undefined) {
        expect(actual).to.deep.equal(expected);
    }

    return actual;
}

export async function expectNoSuggestions(
    textWithPipe: string,
    autocompleteItemSelector: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
): Promise<void> {
    await expectAbridgedAutocompleteItems(textWithPipe, autocompleteItemSelector, undefined);
}

export async function expectTopSuggestions(
    textWithPipe: string,
    autocompleteItemSelector: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
    expected: ReadonlyArray<AbridgedAutocompleteItem>,
): Promise<void> {
    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertAutocompleteItems(
        textWithPipe,
        autocompleteItemSelector,
    );

    const sortedaActual: ReadonlyArray<AbridgedAutocompleteItem> = Array.from(actual)
        .sort((left: Inspection.AutocompleteItem, right: Inspection.AutocompleteItem) => {
            const jaroWinklerDiff: number = right.jaroWinklerScore - left.jaroWinklerScore;

            return jaroWinklerDiff !== 0 ? jaroWinklerDiff : left.label.localeCompare(right.label);
        })
        .slice(0, expected.length)
        .map((value: Inspection.AutocompleteItem) => ({
            label: value.label,
            isTextEdit: value.textEdit !== undefined,
        }));

    expect(sortedaActual).to.deep.equal(expected);
}
