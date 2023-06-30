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

export async function expectAbridgedAutocompleteItems(
    textWithPipe: string,
    fetchAutocompleteItems: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
    expected?: ReadonlyArray<AbridgedAutocompleteItem>,
): Promise<ReadonlyArray<AbridgedAutocompleteItem>> {
    const actual: ReadonlyArray<AbridgedAutocompleteItem> = (
        await expectAbridgedAutocompleteInternal(textWithPipe, fetchAutocompleteItems)
    ).map((value: InternalAbridgedAutocompleteItem) => ({
        label: value.label,
        isTextEdit: value.isTextEdit,
    }));

    if (expected !== undefined) {
        expect(actual).to.deep.equal(expected);
    }

    return actual;
}

export async function expectNoSuggestions(
    textWithPipe: string,
    fetchAutocompleteItems: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
): Promise<void> {
    await expectAbridgedAutocompleteItems(textWithPipe, fetchAutocompleteItems, undefined);
}

export async function expectTopSuggestions(
    textWithPipe: string,
    fetchAutocompleteItems: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
    expected: ReadonlyArray<AbridgedAutocompleteItem>,
): Promise<void> {
    const actual: ReadonlyArray<InternalAbridgedAutocompleteItem> = await expectAbridgedAutocompleteInternal(
        textWithPipe,
        fetchAutocompleteItems,
    );

    const sortedaActual: ReadonlyArray<AbridgedAutocompleteItem> = Array.from(actual)
        .sort((left: InternalAbridgedAutocompleteItem, right: InternalAbridgedAutocompleteItem) => {
            const jaroWinklerDiff: number = right.jaroWinklerScore - left.jaroWinklerScore;

            return jaroWinklerDiff !== 0 ? jaroWinklerDiff : left.label.localeCompare(right.label);
        })
        .slice(0, expected.length)
        .map((value: InternalAbridgedAutocompleteItem) => ({
            label: value.label,
            isTextEdit: value.isTextEdit,
        }));

    expect(sortedaActual).to.deep.equal(expected);
}

interface InternalAbridgedAutocompleteItem {
    readonly label: string;
    readonly isTextEdit: boolean;
    readonly jaroWinklerScore: number;
}

async function expectAbridgedAutocompleteInternal(
    textWithPipe: string,
    fetchAutocompleteItems: (autocomplete: Inspection.Autocomplete) => ReadonlyArray<Inspection.AutocompleteItem>,
): Promise<ReadonlyArray<InternalAbridgedAutocompleteItem>> {
    const autocomplete: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
        TestConstants.DefaultInspectionSettings,
        textWithPipe,
    );

    const actual: ReadonlyArray<Inspection.AutocompleteItem> = fetchAutocompleteItems(autocomplete);

    return actual.map((value: Inspection.AutocompleteItem) => ({
        label: value.label,
        isTextEdit: value.textEdit !== undefined,
        jaroWinklerScore: value.jaroWinklerScore,
    }));
}
