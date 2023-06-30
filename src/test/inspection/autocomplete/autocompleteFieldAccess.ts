// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";
import {
    AbridgedAutocompleteItem,
    expectAbridgedAutocompleteItems,
    expectNoSuggestions,
    expectTopSuggestions,
} from "./autocompleteTestUtils";

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    // async function runTest(textWithPipe: string, expected: ReadonlyArray<string>): Promise<void> {
    //     const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
    //         TestConstants.DefaultInspectionSettings,
    //         textWithPipe,
    //     );

    //     ResultUtils.assertIsOk(actual.triedFieldAccess);

    //     TestUtils.assertContainsAutocompleteItemLabels(
    //         expected,
    //         actual.triedFieldAccess.value?.autocompleteItems ?? [],
    //     );
    // }

    function assertAutocompleteFieldAccess(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedFieldAccess)?.autocompleteItems ?? [];
    }

    function expectNoFieldAccessSuggestions(textWithPipe: string): Promise<void> {
        return expectNoSuggestions(textWithPipe, assertAutocompleteFieldAccess);
    }

    async function expectFieldAccessAutocompleteItems(
        textWithPipe: string,
        labels: ReadonlyArray<string>,
        isTextEdit: boolean,
    ): Promise<void> {
        await expectAbridgedAutocompleteItems(
            textWithPipe,
            assertAutocompleteFieldAccess,
            labels.map((label: string) => ({
                label,
                isTextEdit,
            })),
        );
    }

    function expectFieldAccessInserts(textWithPipe: string, labels: ReadonlyArray<string>): Promise<void> {
        return expectFieldAccessAutocompleteItems(textWithPipe, labels, false);
    }

    function expectFieldAccessReplacements(textWithPipe: string, labels: ReadonlyArray<string>): Promise<void> {
        return expectFieldAccessAutocompleteItems(textWithPipe, labels, true);
    }

    function expectTopFieldAccessAutocompleteItems(
        textWithPipe: string,
        labels: ReadonlyArray<string>,
        isTextEdit: boolean,
    ): Promise<void> {
        return expectTopSuggestions(
            textWithPipe,
            assertAutocompleteFieldAccess,
            labels.map((label: string) => ({
                label,
                isTextEdit,
            })),
        );
    }

    function expectTopFieldAccessInserts(textWithPipe: string, labels: ReadonlyArray<string>): Promise<void> {
        return expectTopFieldAccessAutocompleteItems(textWithPipe, labels, false);
    }

    function expectTopFieldAccessReplacements(textWithPipe: string, labels: ReadonlyArray<string>): Promise<void> {
        return expectTopFieldAccessAutocompleteItems(textWithPipe, labels, true);
    }

    describe(`Selection`, () => {
        it("[][|]", () => expectNoFieldAccessSuggestions("[][|]"));

        it("[][| ]", () => expectNoFieldAccessSuggestions("[][| ]"));

        it("[][ |]", () => expectNoFieldAccessSuggestions("[][ |]"));

        it("[][ | ]", () => expectNoFieldAccessSuggestions("[][ | ]"));

        it("[][|", () => expectNoFieldAccessSuggestions("[][|"));

        it("[][ |", () => expectNoFieldAccessSuggestions("[][ |"));

        it("[car = 1, cat = 2][| ", () => expectTopFieldAccessInserts("[cat = 1, car = 2][|", ["car", "cat"]));

        it("[car = 1, cat = 2][ | ", () => expectTopFieldAccessInserts("[cat = 1, car = 2][ |", ["car", "cat"]));

        it("[car = 1, cat = 2][ | ] ", () => expectTopFieldAccessInserts("[cat = 1, car = 2][ | ]", ["car", "cat"]));

        it("WIP [car = 1, cat = 2][|c", () =>
            expectTopFieldAccessReplacements("[cat = 1, car = 2][|c", ["car", "cat"]));

        it("[car = 1, cat = 2][c|", () => expectTopFieldAccessReplacements("[cat = 1, car = 2][c|", ["car", "cat"]));

        it("[car = 1, cat = 2][ca|", () => expectTopFieldAccessReplacements("[cat = 1, car = 2][ca|", ["car", "cat"]));

        it("[car = 1, cat = 2][car|", () =>
            expectTopFieldAccessReplacements("[cat = 1, car = 2][car|", ["car", "cat"]));

        it("[car = 1, cat = 2][cart|", () =>
            expectTopFieldAccessReplacements("[cat = 1, car = 2][cart|", ["car", "cat"]));

        it("[car = 1, cat = 2][c|]", () => expectTopFieldAccessReplacements("[cat = 1, car = 2][c|]", ["car", "cat"]));

        it("[car = 1, cat = 2][ca|]", () =>
            expectTopFieldAccessReplacements("[cat = 1, car = 2][ca|]", ["car", "cat"]));

        it("[car = 1, cat = 2][car|]", () =>
            expectTopFieldAccessReplacements("[cat = 1, car = 2][car|]", ["car", "cat"]));

        it("WIP [car = 1, cat = 2][cart|]", () =>
            expectTopFieldAccessReplacements("[cat = 1, car = 2][cart|]", ["car", "cat"]));
    });

    /*
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, () => runTest(`[cat = 1, car = 2][x|]`, []));

            it(`[cat = 1, car = 2][c|]`, () => runTest(`[cat = 1, car = 2][c|]`, ["cat", "car"]));

            it(`[cat = 1, car = 2][| c]`, () => runTest(`[cat = 1, car = 2][| c]`, []));

            it(`[cat = 1, car = 2][c |]`, () => runTest(`[cat = 1, car = 2][c |]`, []));

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () =>
                runTest(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, [
                    "foo",
                    "foobar",
                ]));
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, () => runTest(`[cat = 1, car = 2][|]`, ["cat", "car"]));

            it(`[cat = 1, car = 2]|[`, () => runTest(`[cat = 1, car = 2]|[`, []));

            it(`[cat = 1, car = 2][|`, () => runTest(`[cat = 1, car = 2][|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][x|`, () => runTest(`[cat = 1, car = 2][x|`, []));

            it(`[cat = 1, car = 2][c|`, () => runTest(`[cat = 1, car = 2][c|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][c |`, () => runTest(`[cat = 1, car = 2][c |`, []));

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, () =>
                runTest(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, [
                    "foo",
                    "bar",
                    "foobar",
                ]));
        });
    });

    describe("Projection", () => {
        describe("ParseOk", () => {
            it(`[cat = 1, car = 2][ [x|] ]`, () => runTest(`[cat = 1, car = 2][ [x|] ]`, []));

            it(`[cat = 1, car = 2][ [c|] ]`, () => runTest(`[cat = 1, car = 2][ [c|] ]`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [c |] ]`, () => runTest(`[cat = 1, car = 2][ [c |] ]`, []));

            it(`[cat = 1, car = 2][ [x], [c|] ]`, () => runTest(`[cat = 1, car = 2][ [x], [c|] ]`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, () => runTest(`[cat = 1, car = 2][ [cat], [c|] ]`, ["car"]));

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, () =>
                runTest(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, []));
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, () => runTest(`[cat = 1, car = 2][ [|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [ |`, () => runTest(`[cat = 1, car = 2][ [ |`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [ c|`, () => runTest(`[cat = 1, car = 2][ [ c|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [ cat|`, () => runTest(`[cat = 1, car = 2][ [ cat|`, ["cat"]));

            it(`[cat = 1, car = 2][ [ cat |`, () => runTest(`[cat = 1, car = 2][ [ cat |`, []));

            it(`[cat = 1, car = 2][ [ cat ]|`, () => runTest(`[cat = 1, car = 2][ [ cat ]|`, []));

            it(`[cat = 1, car = 2][ [ cat ] |`, () => runTest(`[cat = 1, car = 2][ [ cat ] |`, []));

            it(`[cat = 1, car = 2][ [ cat ]|`, () => runTest(`[cat = 1, car = 2][ [ cat ]|`, []));

            it(`[cat = 1, car = 2][ [ cat ]|`, () => runTest(`[cat = 1, car = 2][ [ cat ]|`, []));

            it(`[cat = 1, car = 2][ [ cat ], |`, () => runTest(`[cat = 1, car = 2][ [ cat ], |`, []));

            it(`[cat = 1, car = 2][ [ cat ], [|`, () => runTest(`[cat = 1, car = 2][ [ cat ], [|`, ["car"]));

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, () => runTest(`[cat = 1, car = 2][ [ cat ], [|<>`, ["car"]));

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, () => runTest(`[cat = 1, car = 2][ [ cat ], [| <>`, ["car"]));

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, () => runTest(`[cat = 1, car = 2][ [ cat ], [<>|`, []));
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, () =>
            runTest(`let fn = () => [cat = 1, car = 2] in fn()[|`, ["cat", "car"]));

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, () =>
            runTest(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, ["cat", "car"]));

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, () =>
            runTest(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, ["cat", "car"]));

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () =>
            runTest(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, ["cat", "car"]));
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, () =>
            runTest(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, [
                `regularIdentifier`,
                `#"generalized identifier"`,
            ]));
    });
    */
});
