// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { TestConstants, TestUtils } from "..";
import { AbridgedAutocompleteItem } from "./abridgedTestUtils";
import { AutocompleteItemUtils } from "../../powerquery-language-services/inspection";
import { Inspection } from "../../powerquery-language-services";

export async function expectAbridgedAutocompleteItems(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
}): Promise<ReadonlyArray<AbridgedAutocompleteItem>> {
    return (await expectAutocompleteItems(params)).map(TestUtils.abridgedAutocompleteItem);
}

export async function expectAutocomplete(textWithPipe: string): Promise<Inspection.Autocomplete> {
    return (
        await TestUtils.assertInspected({
            textWithPipe,
            inspectionSettings: TestConstants.DefaultInspectionSettings,
        })
    ).autocomplete;
}

export async function expectAutocompleteItems(params: {
    readonly textWithPipe: string;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
}): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    return params.autocompleteItemSelector(await expectAutocomplete(params.textWithPipe));
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
    });
}

export async function expectSuggestions(params: {
    readonly textWithPipe: string;
    readonly expected: ReadonlyArray<AbridgedAutocompleteItem>;
    readonly autocompleteItemSelector: (
        autocomplete: Inspection.Autocomplete,
    ) => ReadonlyArray<Inspection.AutocompleteItem>;
}): Promise<void> {
    const actual: ReadonlyArray<AbridgedAutocompleteItem> = await expectAbridgedAutocompleteItems({
        textWithPipe: params.textWithPipe,
        autocompleteItemSelector: params.autocompleteItemSelector,
    });

    TestUtils.assertEqualAbridgedAutocompleteItems({
        expected: params.expected,
        actual,
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

    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await expectAutocompleteItems(params);

    const byJaroWinklerScore: ReadonlyArray<Inspection.AutocompleteItem> = Array.from(actual).sort(
        AutocompleteItemUtils.comparer,
    );

    const topN: ReadonlyArray<AbridgedAutocompleteItem> = byJaroWinklerScore
        .slice(0, params.expected.length)
        .map(TestUtils.abridgedAutocompleteItem);

    const remainderAboveThreshold: ReadonlyArray<Inspection.AutocompleteItem> = byJaroWinklerScore
        .slice(params.expected.length)
        .filter((value: Inspection.AutocompleteItem) => value.jaroWinklerScore >= remainderScoreThreshold);

    expect(topN).to.deep.equal(params.expected);
    expect(remainderAboveThreshold).to.be.empty;
}
