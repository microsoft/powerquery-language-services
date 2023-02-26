// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

async function assertFieldAccessAutocomplete(textWithPosition: string, expected: ReadonlyArray<string>): Promise<void> {
    const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPosition);

    const actual: Inspection.Autocomplete = await TestUtils.assertGetAutocomplete(
        TestConstants.DefaultInspectionSettings,
        text,
        position,
    );

    Assert.isOk(actual.triedFieldAccess);

    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedFieldAccess.value?.autocompleteItems ?? []);
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][x|]`, []));

            it(`[cat = 1, car = 2][c|]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][c|]`, ["cat", "car"]));

            it(`[cat = 1, car = 2][| c]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][| c]`, []));

            it(`[cat = 1, car = 2][c |]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][c |]`, []));

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () =>
                assertFieldAccessAutocomplete(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`,
                    ["foo", "foobar"],
                ));
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][|]`, ["cat", "car"]));

            it(`[cat = 1, car = 2]|[`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2]|[`, []));

            it(`[cat = 1, car = 2][|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][x|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][x|`, []));

            it(`[cat = 1, car = 2][c|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][c|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][c |`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][c |`, []));

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, () =>
                assertFieldAccessAutocomplete(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`,
                    ["foo", "bar", "foobar"],
                ));
        });
    });

    describe("Projection", () => {
        describe("ParseOk", () => {
            it(`[cat = 1, car = 2][ [x|] ]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [x|] ]`, []));

            it(`[cat = 1, car = 2][ [c|] ]`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [c|] ]`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [c |] ]`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [c |] ]`, []));

            it(`[cat = 1, car = 2][ [x], [c|] ]`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [x], [c|] ]`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [cat], [c|] ]`, ["car"]));

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, []));
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [ |`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ |`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [ c|`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ c|`, ["cat", "car"]));

            it(`[cat = 1, car = 2][ [ cat|`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat|`, ["cat"]));

            it(`[cat = 1, car = 2][ [ cat |`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat |`, []));

            it(`[cat = 1, car = 2][ [ cat ]|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ]|`, []));

            it(`[cat = 1, car = 2][ [ cat ] |`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ] |`, []));

            it(`[cat = 1, car = 2][ [ cat ]|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ]|`, []));

            it(`[cat = 1, car = 2][ [ cat ]|`, () => assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ]|`, []));

            it(`[cat = 1, car = 2][ [ cat ], |`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ], |`, []));

            it(`[cat = 1, car = 2][ [ cat ], [|`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ], [|`, ["car"]));

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ], [|<>`, ["car"]));

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ], [| <>`, ["car"]));

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, () =>
                assertFieldAccessAutocomplete(`[cat = 1, car = 2][ [ cat ], [<>|`, []));
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, () =>
            assertFieldAccessAutocomplete(`let fn = () => [cat = 1, car = 2] in fn()[|`, ["cat", "car"]));

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, () =>
            assertFieldAccessAutocomplete(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, ["cat", "car"]));

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, () =>
            assertFieldAccessAutocomplete(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, [
                "cat",
                "car",
            ]));

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () =>
            assertFieldAccessAutocomplete(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, [
                "cat",
                "car",
            ]));
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, () =>
            assertFieldAccessAutocomplete(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, [
                `regularIdentifier`,
                `#"generalized identifier"`,
            ]));
    });
});
