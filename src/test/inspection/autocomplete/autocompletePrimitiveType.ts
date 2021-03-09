// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestUtils, TestConstants } from "../..";
import { Inspection } from "../../../powerquery-language-services";
import { InspectionSettings } from "../../../powerquery-language-services/inspection";

function assertGetParseOkAutocompleteOkPrimitiveType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.AutocompletePrimitiveType {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedPrimitiveType);
    return actual.triedPrimitiveType.value;
}

function assertGetParseErrAutocompleteOkPrimitiveType<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.AutocompletePrimitiveType {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedPrimitiveType);
    return actual.triedPrimitiveType.value;
}

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it("type|", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type|`);
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type |", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type |`);
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = type|", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`let x = type|`);
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let x = type |", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`let x = type |`);
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type | number", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type | number`);
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("type n|", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type n|`);
        const expected: Inspection.AutocompletePrimitiveType = [
            PQP.Language.Constant.PrimitiveTypeConstantKind.None,
            PQP.Language.Constant.PrimitiveTypeConstantKind.Null,
            PQP.Language.Constant.PrimitiveTypeConstantKind.Number,
        ];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x|) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`(x|) => 1`);
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as| number) => 1`,
        );
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as | number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as | number) => 1`,
        );
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as| nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as| nullable number) => 1`,
        );
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as | nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as | nullable number) => 1`,
        );
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as nullable| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as nullable| number) => 1`,
        );
        const expected: Inspection.AutocompletePrimitiveType = [];
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("(x as nullable num|ber) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as nullable num|ber) => 1`,
        );
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseOkAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });

    it("let a = 1 is |", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`let a = 1 is |`);
        const expected: Inspection.AutocompletePrimitiveType = PQP.Language.Constant.PrimitiveTypeConstantKinds;
        const actual: Inspection.AutocompletePrimitiveType = assertGetParseErrAutocompleteOkPrimitiveType(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.have.members(expected);
    });
});
