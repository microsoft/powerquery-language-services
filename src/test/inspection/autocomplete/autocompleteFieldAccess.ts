// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

type AbridgedAutocompleteFieldAccess = ReadonlyArray<string>;

function abridgedFieldAccess(
    maybeAutocompleteFieldAccess: Inspection.AutocompleteFieldAccess | undefined,
): AbridgedAutocompleteFieldAccess {
    if (maybeAutocompleteFieldAccess === undefined) {
        return [];
    }

    return maybeAutocompleteFieldAccess.autocompleteItems.map((item: Inspection.AutocompleteItem) => item.key);
}

function assertGetParseOkAutocompleteOkFieldAccess<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & Inspection.InspectionSettings,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

function assertGetParseErrAutocompleteOkFieldAccess<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: PQP.LexSettings & PQP.ParseSettings<S> & Inspection.InspectionSettings,
    text: string,
    position: Inspection.Position,
): AbridgedAutocompleteFieldAccess {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(settings, text, position);
    Assert.isOk(actual.triedFieldAccess);
    return abridgedFieldAccess(actual.triedFieldAccess.value);
}

describe(`Inspection - Autocomplete - FieldSelection`, () => {
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[cat = 1, car = 2][x|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][| c]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][| c]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c |]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["foo", "foobar"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][|]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2]|[`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2]|[`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][x|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][x|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][c |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][c |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["foo", "bar", "foobar"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });
    });

    describe("Projection", () => {
        describe("ParseOk", () => {
            it(`[cat = 1, car = 2][ [x|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [c |] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [c |] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [x], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [x], [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [cat], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [cat], [car], [c|] ]`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [cat], [car], [c|] ]`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseOkAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });

        describe(`ParseErr`, () => {
            it(`[cat = 1, car = 2][ [|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ c|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ c|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["cat"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ] |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ] |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ]|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ]|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], |`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], |`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [|<>`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [|<>`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [| <>`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [| <>`,
                );
                const expected: AbridgedAutocompleteFieldAccess = ["car"];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });

            it(`[cat = 1, car = 2][ [ cat ], [<>|`, () => {
                const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                    `[cat = 1, car = 2][ [ cat ], [<>|`,
                );
                const expected: AbridgedAutocompleteFieldAccess = [];
                const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                    TestConstants.DefaultSettings,
                    text,
                    position,
                );
                expect(actual).to.have.members(expected);
            });
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [cat = 1, car = 2] in fn()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let fn = () => [cat = 1, car = 2] in fn()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = foo in bar()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => [cat = 1, car = 2], bar = () => foo in bar()()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = ["cat", "car"];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });

    describe(`GeneralizedIdentifier`, () => {
        it(`[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`, () => {
            const [text, position]: [string, Inspection.Position] = TestUtils.assertGetTextWithPosition(
                `[#"regularIdentifier" = 1, #"generalized identifier" = 2][|`,
            );
            const expected: AbridgedAutocompleteFieldAccess = [`regularIdentifier`, `#"generalized identifier"`];
            const actual: AbridgedAutocompleteFieldAccess = assertGetParseErrAutocompleteOkFieldAccess(
                TestConstants.DefaultSettings,
                text,
                position,
            );
            expect(actual).to.have.members(expected);
        });
    });
});
