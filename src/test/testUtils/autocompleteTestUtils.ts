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
    return (
        await TestUtils.assertInspected({
            textWithPipe,
            inspectionSettings: TestConstants.DefaultInspectionSettings,
        })
    ).autocomplete;
}

export async function assertAutocompleteItems(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
}): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    return params.autocompleteItemSelector(await assertAutocomplete(params.textWithPipe));
}

export async function expectAbridgedAutocompleteItems(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
    readonly expected?: ReadonlyArray<AbridgedAutocompleteItem>;
}): Promise<ReadonlyArray<AbridgedAutocompleteItem>> {
    const actual: ReadonlyArray<AbridgedAutocompleteItem> = (await assertAutocompleteItems(params)).map(
        createAbridgedAutocompleteItem,
    );

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

export async function expectTopSuggestions(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
    readonly expected: ReadonlyArray<AbridgedAutocompleteItem>;
    readonly remainderScoreThreshold?: number;
}): Promise<void> {
    const remainderScoreThreshold: number = params.remainderScoreThreshold ?? 0.8;

    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertAutocompleteItems(params);

    const byJaroWinklerScore: ReadonlyArray<Inspection.AutocompleteItem> = Array.from(actual).sort(
        AutocompleteItemUtils.comparer,
    );

    const topN: ReadonlyArray<AbridgedAutocompleteItem> = byJaroWinklerScore
        .slice(0, params.expected.length)
        .map(createAbridgedAutocompleteItem);

    const remainderAboveThreshold: ReadonlyArray<Inspection.AutocompleteItem> = byJaroWinklerScore
        .slice(params.expected.length)
        .filter((value: Inspection.AutocompleteItem) => value.jaroWinklerScore >= remainderScoreThreshold);

    expect(topN).to.deep.equal(params.expected);
    expect(remainderAboveThreshold).to.be.empty;
}

export function createAbridgedAutocompleteItem(value: Inspection.AutocompleteItem): AbridgedAutocompleteItem {
    return {
        label: value.label,
        isTextEdit: value.textEdit !== undefined,
    };
}
