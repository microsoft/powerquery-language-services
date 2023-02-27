// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    async function runTest(textWithPipe: string, expected: ReadonlyArray<string>): Promise<void> {
        const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
            TestConstants.DefaultInspectionSettings,
            textWithPipe,
        );

        Assert.isOk(actual.triedFieldAccess);

        TestUtils.assertContainsAutocompleteItemLabels(
            expected,
            actual.triedFieldAccess.value?.autocompleteItems ?? [],
        );
    }

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
});
