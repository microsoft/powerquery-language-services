// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { expect } from "chai";
import "mocha";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection, InspectionSettings } from "../../../powerquery-language-services";
import { AbridgedAutocompleteItem, createAbridgedAutocompleteItem } from "./common";

function assertGetLanguageConstantAutocomplete(
    settings: InspectionSettings,
    text: string,
    position: Position,
): AbridgedAutocompleteItem | undefined {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedLanguageConstant);

    return actual.triedLanguageConstant.value
        ? createAbridgedAutocompleteItem(actual.triedLanguageConstant.value)
        : undefined;
}

describe(`Inspection - Autocomplete - Language constants`, () => {
    it(`a as |`, () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`a as |`);
        const expected: AbridgedAutocompleteItem | undefined = {
            jaroWinklerScore: 1,
            label: Constant.LanguageConstant.Nullable,
        };
        const actual: AbridgedAutocompleteItem | undefined = assertGetLanguageConstantAutocomplete(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it(`a as n|`, () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`a as n|`);
        const expected: AbridgedAutocompleteItem | undefined = {
            jaroWinklerScore: 1,
            label: Constant.LanguageConstant.Nullable,
        };
        const actual: AbridgedAutocompleteItem | undefined = assertGetLanguageConstantAutocomplete(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it(`(a as |`, () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(a as |`);
        const expected: AbridgedAutocompleteItem | undefined = {
            jaroWinklerScore: 1,
            label: Constant.LanguageConstant.Nullable,
        };
        const actual: AbridgedAutocompleteItem | undefined = assertGetLanguageConstantAutocomplete(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it(`(a as n|`, () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(a as n|`);
        const expected: AbridgedAutocompleteItem | undefined = {
            jaroWinklerScore: 1,
            label: Constant.LanguageConstant.Nullable,
        };
        const actual: AbridgedAutocompleteItem | undefined = assertGetLanguageConstantAutocomplete(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it(`(x, |`, () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x, |`);
        const expected: AbridgedAutocompleteItem | undefined = {
            jaroWinklerScore: 1,
            label: Constant.LanguageConstant.Optional,
        };
        const actual: AbridgedAutocompleteItem | undefined = assertGetLanguageConstantAutocomplete(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it(`(x, op|`, () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x, op|`);
        const expected: AbridgedAutocompleteItem | undefined = {
            jaroWinklerScore: 1,
            label: Constant.LanguageConstant.Optional,
        };
        const actual: AbridgedAutocompleteItem | undefined = assertGetLanguageConstantAutocomplete(
            TestConstants.DefaultInspectionSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });
});
