// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { ResultUtils } from "@microsoft/powerquery-parser";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { Inspection, InspectionSettings, TypeStrategy } from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";

describe("Inspection - Type directives", () => {
    const EnabledInspectionSettings: InspectionSettings = {
        ...TestConstants.SimpleInspectionSettings,
        isTypeDirectiveAllowed: true,
    };

    const PrimitiveEnabledInspectionSettings: InspectionSettings = {
        ...EnabledInspectionSettings,
        typeStrategy: TypeStrategy.Primitive,
    };

    function fieldAccessAutocompleteItemSelector(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedFieldAccess)?.autocompleteItems ?? [];
    }

    async function autocompleteLabels(
        textWithPipe: string,
        inspectionSettings: InspectionSettings,
    ): Promise<ReadonlyArray<string>> {
        const inspected: Inspection.Inspected = await TestUtils.assertInspected({
            textWithPipe,
            inspectionSettings,
        });

        return fieldAccessAutocompleteItemSelector(inspected.autocomplete).map(
            (item: Inspection.AutocompleteItem) => item.label,
        );
    }

    it("ignores type directives when disabled", async () => {
        const actual: Type.TPowerQueryType = await TestUtils.assertRootType({
            text: `let
    /// @type [ Foo = text, Bar = number ]
    value = []
in
    value`,
            inspectionSettings: TestConstants.SimpleInspectionSettings,
        });

        expect(actual.extendedKind).to.equal(Type.ExtendedTypeKind.DefinedRecord);
        expect([...(actual as Type.DefinedRecord).fields.keys()]).to.deep.equal([]);
    });

    it("applies inline type directives when enabled", async () => {
        const actual: Type.TPowerQueryType = await TestUtils.assertRootType({
            text: `let
    /// @type [ Foo = text, Bar = number ]
    value = []
in
    value`,
            inspectionSettings: EnabledInspectionSettings,
        });

        expect(actual.extendedKind).to.equal(Type.ExtendedTypeKind.RecordType);
        expect([...(actual as Type.RecordType).fields.keys()]).to.deep.equal(["Foo", "Bar"]);
    });

    it("applies identifier type directives when enabled", async () => {
        const actual: ReadonlyArray<string> = await autocompleteLabels(
            `let
    Resource.Type = type [ Foo = text, Bar = number ],
    /// @type Resource.Type
    value = []
in
    value[|]`,
            EnabledInspectionSettings,
        );

        expect(actual).to.include.members(["Foo", "Bar"]);
    });

    it("applies inline type directives when enabled under primitive strategy", async () => {
        const actual: Type.TPowerQueryType = await TestUtils.assertRootType({
            text: `let
    /// @type [ Foo = text, Bar = number ]
    value = []
in
    value`,
            inspectionSettings: PrimitiveEnabledInspectionSettings,
        });

        expect(actual.extendedKind).to.equal(Type.ExtendedTypeKind.RecordType);
        expect([...(actual as Type.RecordType).fields.keys()]).to.deep.equal(["Foo", "Bar"]);
    });

    it("applies identifier type directives when enabled under primitive strategy", async () => {
        const actual: ReadonlyArray<string> = await autocompleteLabels(
            `let
    Resource.Type = type [ Foo = text, Bar = number ],
    /// @type Resource.Type
    value = []
in
    value[|]`,
            PrimitiveEnabledInspectionSettings,
        );

        expect(actual).to.include.members(["Foo", "Bar"]);
    });

    it("does not add identifier-based field suggestions when disabled", async () => {
        const actual: ReadonlyArray<string> = await autocompleteLabels(
            `let
    Resource.Type = type [ Foo = text, Bar = number ],
    /// @type Resource.Type
    value = []
in
    value[|]`,
            TestConstants.SimpleInspectionSettings,
        );

        expect(actual).to.deep.equal([]);
    });
});
