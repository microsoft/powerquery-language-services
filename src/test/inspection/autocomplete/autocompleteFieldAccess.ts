// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert } from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { Inspection, InspectionSettings } from "../../../powerquery-language-services";
import { TestConstants, TestUtils } from "../..";

async function assertGetFieldAccessAutocomplete(
    settings: InspectionSettings,
    text: string,
    position: Position,
): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    const actual: Inspection.Autocomplete = await TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);

    return actual.triedFieldAccess.value ? actual.triedFieldAccess.value.autocompleteItems : [];
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][x|]`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c|]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][c|]`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][| c]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][| c]`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c |]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][c |]`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`,
                );

                const expected: ReadonlyArray<string> = ["foo", "foobar"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][|]`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2]|[`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2]|[`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][|`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][x|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][x|`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][c|`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][c |`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`,
                );

                const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });
    });

    describe("Projection", () => {
        describe("ParseOk", () => {
            it(`[cat = 1, car = 2][ [x|] ]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [x|] ]`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [c|] ]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [c|] ]`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [c |] ]`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [c |] ]`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [x], [c|] ]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x], [c|] ]`,
                );

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [c|] ]`,
                );

                const expected: ReadonlyArray<string> = ["car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [car], [c|] ]`,
                );

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [|`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ |`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ c|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ c|`);

                const expected: ReadonlyArray<string> = ["cat", "car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat|`);

                const expected: ReadonlyArray<string> = ["cat"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat |`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat ]|`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ] |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat ] |`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat ]|`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat ]|`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`[cat = 1, car = 2][ [ cat ], |`);

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|`,
                );

                const expected: ReadonlyArray<string> = ["car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|<>`,
                );

                const expected: ReadonlyArray<string> = ["car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [| <>`,
                );

                const expected: ReadonlyArray<string> = ["car"];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [<>|`,
                );

                const expected: ReadonlyArray<string> = [];

                const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );

                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let fn = () => [cat = 1, car = 2] in fn()[|`,
            );

            const expected: ReadonlyArray<string> = ["cat", "car"];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`,
            );

            const expected: ReadonlyArray<string> = ["cat", "car"];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`,
            );

            const expected: ReadonlyArray<string> = ["cat", "car"];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`,
            );

            const expected: ReadonlyArray<string> = ["cat", "car"];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`,
            );

            const expected: ReadonlyArray<string> = [`regularIdentifier`, `#"generalized identifier"`];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });
});
