// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, ResultUtils, Task } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import {
    AbridgedAutocompleteItem,
    assertAutocomplete,
    expectAbridgedAutocompleteItems,
    expectNoSuggestions,
    expectTopSuggestions,
} from "./autocompleteTestUtils";
import { Inspection, Position } from "../../../powerquery-language-services";
import { expect } from "chai";
import { Range } from "vscode-languageserver-textdocument";
import { inspectFieldAccess } from "../../../powerquery-language-services/inspection/autocomplete/autocompleteFieldAccess";
import { ActiveNode, ActiveNodeUtils } from "../../../powerquery-language-services/inspection";

describe(`Inspection - Autocomplete - FieldAccess`, () => {
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

    function fieldAccessAutocompleteItemSelector(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedFieldAccess)?.autocompleteItems ?? [];
    }

    function expectNoFieldAccessSuggestions(textWithPipe: string): Promise<void> {
        return expectNoSuggestions(textWithPipe, fieldAccessAutocompleteItemSelector);
    }

    async function expectFieldAccessAutocompleteItems(
        textWithPipe: string,
        labels: ReadonlyArray<string>,
        isTextEdit: boolean,
    ): Promise<void> {
        await expectAbridgedAutocompleteItems(
            textWithPipe,
            fieldAccessAutocompleteItemSelector,
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
            fieldAccessAutocompleteItemSelector,
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

    describe(`FIXME InspectedFieldAccess`, () => {
        async function expectInspectedFieldAccess(
            textWithPipe: string,
            expected: Inspection.InspectedFieldAccess | undefined,
        ): Promise<void> {
            const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);

            const parsed: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse(
                TestConstants.DefaultInspectionSettings,
                text,
            );

            const activeNode: ActiveNode = ActiveNodeUtils.assertActiveNode(parsed.nodeIdMapCollection, position);

            const actual: Inspection.InspectedFieldAccess | undefined = inspectFieldAccess(
                parsed.lexerSnapshot,
                parsed.nodeIdMapCollection,
                activeNode,
            );

            expect(actual).to.deep.equal(expected);
        }

        describe(`FieldSelection`, () => {
            it(`[key with a space = 1][|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][|`, {
                    fieldNames: [],
                    isAutocompleteAllowed: true,
                    textEditRange: undefined,
                    textToAutocompleteUnderPosition: undefined,
                });
            });

            it(`[key with a space = 1][key| with a space`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][key| with a space`, {
                    fieldNames: ["key with a space"],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 23,
                        },
                        end: {
                            line: 0,
                            character: 26,
                        },
                    },
                    textToAutocompleteUnderPosition: "key",
                });
            });

            it(`[key with a space = 1][| key with a space`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][| key with a space`, {
                    fieldNames: [`key with a space`],
                    isAutocompleteAllowed: false,
                    textEditRange: undefined,
                    textToAutocompleteUnderPosition: undefined,
                });
            });

            it(`[key with a space = 1][|#"key with a space" blah`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][|#"key with a space" blah`, {
                    fieldNames: [`#"key with a space" blah`],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 23,
                        },
                        end: {
                            line: 0,
                            character: 42,
                        },
                    },
                    textToAutocompleteUnderPosition: `#"key with a space"`,
                });
            });

            it(`[key with a space = 1][|#"key with a space" blah`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][|#"key with a space" blah`, {
                    fieldNames: [`#"key with a space" blah`],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 23,
                        },
                        end: {
                            line: 0,
                            character: 42,
                        },
                    },
                    textToAutocompleteUnderPosition: `#"key with a space"`,
                });
            });

            it(`[key with a space = 1][#"key| with a space" blah`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][#"key| with a space" blah`, {
                    fieldNames: [`#"key with a space" blah`],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 23,
                        },
                        end: {
                            line: 0,
                            character: 42,
                        },
                    },
                    textToAutocompleteUnderPosition: `#"key with a space"`,
                });
            });

            it(`[key with a space = 1][#|"key with a space" blah`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][#|"key with a space" blah`, {
                    fieldNames: [`#"key with a space" blah`],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 23,
                        },
                        end: {
                            line: 0,
                            character: 42,
                        },
                    },
                    textToAutocompleteUnderPosition: `#"key with a space"`,
                });
            });
        });
    });

    describe(`top suggestions`, () => {
        describe(`FieldSelection`, () => {
            it(`[][|]`, () => expectNoFieldAccessSuggestions(`[][|]`));

            it(`[][| ]`, () => expectNoFieldAccessSuggestions(`[][| ]`));

            it(`[][ |]`, () => expectNoFieldAccessSuggestions(`[][ |]`));

            it(`[][ | ]`, () => expectNoFieldAccessSuggestions(`[][ | ]`));

            it(`[][|`, () => expectNoFieldAccessSuggestions(`[][|`));

            it(`[][ |`, () => expectNoFieldAccessSuggestions(`[][ |`));

            it(`[car = 1, cat = 2][| `, () => expectTopFieldAccessInserts(`[car = 1, cat = 2][|`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][ | `, () => expectTopFieldAccessInserts(`[car = 1, cat = 2][ |`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][ | ] `, () =>
                expectTopFieldAccessInserts(`[car = 1, cat = 2][ | ]`, [`car`, `cat`]));

            it(`let foo = [car = 1, cat = 2][#"test"|`, () =>
                expectTopFieldAccessReplacements(`let foo = [car = 1, cat = 2][#"test"|`, [`cat`, `car`]));

            it(`[car = 1, cat = 2][c|`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][c|`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][ca|`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][ca|`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][car|`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][car|`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][cart|`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][cart|`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][c|]`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][c|]`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][ca|]`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][ca|]`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][car|]`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][car|]`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][cart|]`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][cart|]`, [`car`, `cat`]));
        });
    });

    /*
    describe(`Selection`, () => {
        describe(`ParseOk`, () => {
            it(`[car = 1, cat = 2][x|]`, () => runTest(`[car = 1, cat = 2][x|]`, []));

            it(`[car = 1, cat = 2][c|]`, () => runTest(`[car = 1, cat = 2][c|]`, ["cat", "car"]));

            it(`[car = 1, cat = 2][| c]`, () => runTest(`[car = 1, cat = 2][| c]`, []));

            it(`[car = 1, cat = 2][c |]`, () => runTest(`[car = 1, cat = 2][c |]`, []));

            it(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, () =>
                runTest(`section x; value = [foo = 1, bar = 2, foobar = 3]; valueAccess = value[f|];`, [
                    "foo",
                    "foobar",
                ]));
        });

        describe(`ParseErr`, () => {
            it(`[car = 1, cat = 2][|]`, () => runTest(`[car = 1, cat = 2][|]`, ["cat", "car"]));

            it(`[car = 1, cat = 2]|[`, () => runTest(`[car = 1, cat = 2]|[`, []));

            it(`[car = 1, cat = 2][|`, () => runTest(`[car = 1, cat = 2][|`, ["cat", "car"]));

            it(`[car = 1, cat = 2][x|`, () => runTest(`[car = 1, cat = 2][x|`, []));

            it(`[car = 1, cat = 2][c|`, () => runTest(`[car = 1, cat = 2][c|`, ["cat", "car"]));

            it(`[car = 1, cat = 2][c |`, () => runTest(`[car = 1, cat = 2][c |`, []));

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
            it(`[car = 1, cat = 2][ [x|] ]`, () => runTest(`[car = 1, cat = 2][ [x|] ]`, []));

            it(`[car = 1, cat = 2][ [c|] ]`, () => runTest(`[car = 1, cat = 2][ [c|] ]`, ["cat", "car"]));

            it(`[car = 1, cat = 2][ [c |] ]`, () => runTest(`[car = 1, cat = 2][ [c |] ]`, []));

            it(`[car = 1, cat = 2][ [x], [c|] ]`, () => runTest(`[car = 1, cat = 2][ [x], [c|] ]`, ["cat", "car"]));

            it(`[car = 1, cat = 2][ [cat], [c|] ]`, () => runTest(`[car = 1, cat = 2][ [cat], [c|] ]`, ["car"]));

            it(`[car = 1, cat = 2][ [cat], [car], [c|] ]`, () =>
                runTest(`[car = 1, cat = 2][ [cat], [car], [c|] ]`, []));
        });

        describe(`ParseErr`, () => {
            it(`[car = 1, cat = 2][ [|`, () => runTest(`[car = 1, cat = 2][ [|`, ["cat", "car"]));

            it(`[car = 1, cat = 2][ [ |`, () => runTest(`[car = 1, cat = 2][ [ |`, ["cat", "car"]));

            it(`[car = 1, cat = 2][ [ c|`, () => runTest(`[car = 1, cat = 2][ [ c|`, ["cat", "car"]));

            it(`[car = 1, cat = 2][ [ cat|`, () => runTest(`[car = 1, cat = 2][ [ cat|`, ["cat"]));

            it(`[car = 1, cat = 2][ [ cat |`, () => runTest(`[car = 1, cat = 2][ [ cat |`, []));

            it(`[car = 1, cat = 2][ [ cat ]|`, () => runTest(`[car = 1, cat = 2][ [ cat ]|`, []));

            it(`[car = 1, cat = 2][ [ cat ] |`, () => runTest(`[car = 1, cat = 2][ [ cat ] |`, []));

            it(`[car = 1, cat = 2][ [ cat ]|`, () => runTest(`[car = 1, cat = 2][ [ cat ]|`, []));

            it(`[car = 1, cat = 2][ [ cat ]|`, () => runTest(`[car = 1, cat = 2][ [ cat ]|`, []));

            it(`[car = 1, cat = 2][ [ cat ], |`, () => runTest(`[car = 1, cat = 2][ [ cat ], |`, []));

            it(`[car = 1, cat = 2][ [ cat ], [|`, () => runTest(`[car = 1, cat = 2][ [ cat ], [|`, ["car"]));

            it(`[car = 1, cat = 2][ [ cat ], [|<>`, () => runTest(`[car = 1, cat = 2][ [ cat ], [|<>`, ["car"]));

            it(`[car = 1, cat = 2][ [ cat ], [| <>`, () => runTest(`[car = 1, cat = 2][ [ cat ], [| <>`, ["car"]));

            it(`[car = 1, cat = 2][ [ cat ], [<>|`, () => runTest(`[car = 1, cat = 2][ [ cat ], [<>|`, []));
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [car = 1, cat = 2] in fn()[|`, () =>
            runTest(`let fn = () => [car = 1, cat = 2] in fn()[|`, ["cat", "car"]));

        it(`let foo = () => [car = 1, cat = 2], bar = foo in bar()[|`, () =>
            runTest(`let foo = () => [car = 1, cat = 2], bar = foo in bar()[|`, ["cat", "car"]));

        it(`let foo = () => [car = 1, cat = 2], bar = () => foo in bar()()[|`, () =>
            runTest(`let foo = () => [car = 1, cat = 2], bar = () => foo in bar()()[|`, ["cat", "car"]));

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
