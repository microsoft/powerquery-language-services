// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { TestConstants, TestUtils } from "..";
import { AutocompleteItemUtils } from "../../powerquery-language-services/inspection";
import { Inspection } from "../../powerquery-language-services";

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

export async function expectAbridgedAutocompleteItems(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
    readonly expected?: ReadonlyArray<AbridgedAutocompleteItem>;
}): Promise<ReadonlyArray<AbridgedAutocompleteItem>> {
    const actual: ReadonlyArray<AbridgedAutocompleteItem> = (
        await assertAutocompleteItems(params.textWithPipe, params.autocompleteItemSelector)
    ).map(createAbridgedAutocompleteItem);

    if (params.expected !== undefined) {
        expect(actual).to.have.deep.members(params.expected);
    }

    return actual;
}

export async function expectNoSuggestions(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
}): Promise<void> {
    await expectAbridgedAutocompleteItems({
        textWithPipe: params.textWithPipe,
        autocompleteItemSelector: params.autocompleteItemSelector,
        expected: undefined,
    });
}

export async function expectSuggestions(params: {
    readonly textWithPipe: string;
    readonly expected: ReadonlyArray<AbridgedAutocompleteItem>;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
}): Promise<void> {
    await expectAbridgedAutocompleteItems({
        textWithPipe: params.textWithPipe,
        autocompleteItemSelector: params.autocompleteItemSelector,
        expected: params.expected,
    });
}

export async function expectTopSuggestions(
    textWithPipe: string,
    autocompleteItemSelector: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
    expected: ReadonlyArray<AbridgedAutocompleteItem>,
    remainderScoreThreshold: number = 0.8,
): Promise<void> {
    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertAutocompleteItems(
        textWithPipe,
        autocompleteItemSelector,
    );

    const byJaroWinklerScore: ReadonlyArray<Inspection.AutocompleteItem> = Array.from(actual).sort(
        AutocompleteItemUtils.comparer,
    );

    const topN: ReadonlyArray<AbridgedAutocompleteItem> = byJaroWinklerScore
        .slice(0, expected.length)
        .map(createAbridgedAutocompleteItem);

    const remainderAboveThreshold: ReadonlyArray<Inspection.AutocompleteItem> = byJaroWinklerScore
        .slice(expected.length)
        .filter((value: Inspection.AutocompleteItem) => value.jaroWinklerScore >= remainderScoreThreshold);

    expect(topN).to.deep.equal(expected);
    expect(remainderAboveThreshold).to.be.empty;
}

function createAbridgedAutocompleteItem(value: Inspection.AutocompleteItem): AbridgedAutocompleteItem {
    return {
        label: value.label,
        isTextEdit: value.textEdit !== undefined,
    };
}
