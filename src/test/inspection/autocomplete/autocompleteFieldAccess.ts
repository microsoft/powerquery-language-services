// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import "mocha";
import { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

function assertGetFieldAccessAutocomplete<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: Inspection.InspectionSettings<S>,
    text: string,
    position: Position,
): ReadonlyArray<Inspection.AutocompleteItem> {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);

    return actual.triedFieldAccess.value ? actual.triedFieldAccess.value.autocompleteItems : [];
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|]`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c|]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|]`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][| c]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][| c]`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c |]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |]`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`,
                );
                const expected: ReadonlyArray<string> = ["foo", "foobar"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|]`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2]|[`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2]|[`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][x|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][c |`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`,
                );
                const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
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
            it(`[cat = 1, car = 2][ [x|] ]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x|] ]`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [c|] ]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c|] ]`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [c |] ]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c |] ]`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [x], [c|] ]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x], [c|] ]`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [c|] ]`,
                );
                const expected: ReadonlyArray<string> = ["car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [car], [c|] ]`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [|`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ |`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ |`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ c|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ c|`,
                );
                const expected: ReadonlyArray<string> = ["cat", "car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat|`,
                );
                const expected: ReadonlyArray<string> = ["cat"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat |`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat |`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ] |`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ] |`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], |`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], |`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|`,
                );
                const expected: ReadonlyArray<string> = ["car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|<>`,
                );
                const expected: ReadonlyArray<string> = ["car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [| <>`,
                );
                const expected: ReadonlyArray<string> = ["car"];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [<>|`,
                );
                const expected: ReadonlyArray<string> = [];
                const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultInspectionSettings,
                    text,
                    position,
                );
                TestUtils.assertAutocompleteItemLabels(expected, actual);
            });
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let fn = () => [cat = 1, car = 2] in fn()[|`,
            );
            const expected: ReadonlyArray<string> = ["cat", "car"];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`,
            );
            const expected: ReadonlyArray<string> = ["cat", "car"];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`,
            );
            const expected: ReadonlyArray<string> = ["cat", "car"];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`,
            );
            const expected: ReadonlyArray<string> = ["cat", "car"];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`,
            );
            const expected: ReadonlyArray<string> = [`regularIdentifier`, `#"generalized identifier"`];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultInspectionSettings,
                text,
                position,
            );
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });
});
