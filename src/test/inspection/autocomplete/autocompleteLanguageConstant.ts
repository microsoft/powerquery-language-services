// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

function assertGetParseErrAutocompleteOkLanguageConstant<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & Inspection.InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.AutocompleteLanguageConstant | undefined {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedLanguageConstant);
    return actual.triedLanguageConstant.value;
}

describe(`Inspection - Autocomplete - Language constants`, () => {
    it(`a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`a as |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.equal(PQP.Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.equal(PQP.Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`(a as |`, () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`(a as |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.equal(PQP.Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`(a as n|`, () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`(a as n|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.equal(PQP.Language.Constant.LanguageConstantKind.Nullable);
    });

    it(`(x, |`, () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`(x, |`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.equal(PQP.Language.Constant.LanguageConstantKind.Optional);
    });

    it(`(x, op|`, () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`(x, op|`);
        const actual:
            | Inspection.AutocompleteLanguageConstant
            | undefined = assertGetParseErrAutocompleteOkLanguageConstant(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.equal(PQP.Language.Constant.LanguageConstantKind.Optional);
    });
});
