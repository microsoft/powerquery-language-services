// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import "mocha";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection, InspectionSettings } from "../../../powerquery-language-services";

function assertGetPrimitiveTypeAutocompleteOk(
    settings: InspectionSettings,
    text: string,
    position: Position,
): ReadonlyArray<Inspection.AutocompleteItem> {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedPrimitiveType);
    return actual.triedPrimitiveType.value;
}

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it("type|", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`type|`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("type |", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`type |`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("let x = type|", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = type|`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("let x = type |", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = type |`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("type | number", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`type | number`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("type n|", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`type n|`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [
            Constant.PrimitiveTypeConstantKind.None,
            Constant.PrimitiveTypeConstantKind.Null,
            Constant.PrimitiveTypeConstantKind.Number,
        ];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x|) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x|) => 1`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x as| number) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x as| number) => 1`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x as | number) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x as | number) => 1`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x as| nullable number) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
            `(x as| nullable number) => 1`,
        );
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x as | nullable number) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
            `(x as | nullable number) => 1`,
        );
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x as nullable| number) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
            `(x as nullable| number) => 1`,
        );
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = [];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("(x as nullable num|ber) => 1", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
            `(x as nullable num|ber) => 1`,
        );
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    it("let a = 1 is |", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 is |`);
        const expected: ReadonlyArray<Constant.PrimitiveTypeConstantKind> = Constant.PrimitiveTypeConstantKinds;
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });
});
