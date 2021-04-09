// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";
import { InspectionSettings } from "../../../powerquery-language-services/inspection";
import { AbridgedAutocompleteItem, createAbridgedAutocompleteItems } from "./common";

const AbridgedPrimitiveTypeAutocompleteItems: ReadonlyArray<AbridgedAutocompleteItem> = PQP.Language.Constant.PrimitiveTypeConstantKinds.map(
    (kind: PQP.Language.Constant.PrimitiveTypeConstantKind) => {
        return {
            label: kind,
            jaroWinklerScore: 1,
        };
    },
);

function assertGetPrimitiveTypeAutocompleteOk<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): ReadonlyArray<AbridgedAutocompleteItem> {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedPrimitiveType);
    return createAbridgedAutocompleteItems(actual.triedPrimitiveType.value);
}

describe(`Inspection - Autocomplete - PrimitiveType`, () => {
    it("type|", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type|`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("type |", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type |`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("let x = type|", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`let x = type|`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("let x = type |", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`let x = type |`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("type | number", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type | number`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("type n|", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`type n|`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [
            {
                label: PQP.Language.Constant.PrimitiveTypeConstantKind.None,
                jaroWinklerScore: 0,
            },
            {
                label: PQP.Language.Constant.PrimitiveTypeConstantKind.Null,
                jaroWinklerScore: 0,
            },
            {
                label: PQP.Language.Constant.PrimitiveTypeConstantKind.Number,
                jaroWinklerScore: 0,
            },
        ];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x|) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`(x|) => 1`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x as| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as| number) => 1`,
        );
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x as | number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as | number) => 1`,
        );
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x as| nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as| nullable number) => 1`,
        );
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x as | nullable number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as | nullable number) => 1`,
        );
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x as nullable| number) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as nullable| number) => 1`,
        );
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("(x as nullable num|ber) => 1", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
            `(x as nullable num|ber) => 1`,
        );
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });

    it("WIP let a = 1 is |", () => {
        const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(`let a = 1 is |`);
        const expected: ReadonlyArray<AbridgedAutocompleteItem> = AbridgedPrimitiveTypeAutocompleteItems;
        const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetPrimitiveTypeAutocompleteOk(
            TestConstants.DefaultSettings,
            text,
            position,
        );
        expect(actual).to.deep.equal(expected);
    });
});
