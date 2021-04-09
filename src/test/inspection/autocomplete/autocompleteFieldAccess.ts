// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";
import {
    AbridgedAutocompleteItem,
    createAbridgedAutocompleteItems,
    createTweakedAbridgedAutocompleteItems,
} from "./common";

function assertGetFieldAccessAutocomplete<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & Inspection.InspectionSettings,
    text: string,
    position: Inspection.Position,
): ReadonlyArray<AbridgedAutocompleteItem> {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);

    return actual.triedFieldAccess.value
        ? createAbridgedAutocompleteItems(actual.triedFieldAccess.value.autocompleteItems)
        : [];
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][c|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][| c]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][| c]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][c |]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "foo",
                    "foobar",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2]|[`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2]|[`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][x|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][c|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][c |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "foo",
                    "bar",
                    "foobar",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });
        });
    });

    describe("Projection", () => {
        describe("ParseOk", () => {
            it(`[cat = 1, car = 2][ [x|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x|] ]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c|] ]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [c |] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c |] ]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [x], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x], [c|] ]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [c|] ]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [car], [c|] ]`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ |`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ c|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ c|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "cat",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat |`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ] |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ] |`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], |`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|<>`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [| <>`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                    "car",
                ]);
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [<>|`,
                );
                const expected: ReadonlyArray<AbridgedAutocompleteItem> = [];
                const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.deep.equal(expected);
            });
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let fn = () => [cat = 1, car = 2] in fn()[|`,
            );
            const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                "cat",
                "car",
            ]);
            const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.deep.equal(expected);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`,
            );
            const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                "cat",
                "car",
            ]);
            const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.deep.equal(expected);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`,
            );
            const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                "cat",
                "car",
            ]);
            const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.deep.equal(expected);
        });

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`,
            );
            const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                "cat",
                "car",
            ]);
            const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`,
            );
            const expected: ReadonlyArray<AbridgedAutocompleteItem> = createTweakedAbridgedAutocompleteItems([
                `regularIdentifier`,
                `#"generalized identifier"`,
            ]);
            const actual: ReadonlyArray<AbridgedAutocompleteItem> = assertGetFieldAccessAutocomplete(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.deep.equal(expected);
        });
    });
});
