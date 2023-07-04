// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { ResultUtils, Task } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils } from "../../../powerquery-language-services/inspection";
import { expectNoSuggestions, expectTopSuggestions } from "./autocompleteTestUtils";
import { Inspection, Position } from "../../../powerquery-language-services";
import { TestConstants, TestUtils } from "../..";
import { expect } from "chai";
import { inspectFieldAccess } from "../../../powerquery-language-services/inspection/autocomplete/autocompleteFieldAccess";

describe(`Inspection - Autocomplete - FieldAccess`, () => {
    function fieldAccessAutocompleteItemSelector(
        autocomplete: Inspection.Autocomplete,
    ): ReadonlyArray<Inspection.AutocompleteItem> {
        return ResultUtils.assertOk(autocomplete.triedFieldAccess)?.autocompleteItems ?? [];
    }

    function expectNoFieldAccessSuggestions(textWithPipe: string): Promise<void> {
        return expectNoSuggestions(textWithPipe, fieldAccessAutocompleteItemSelector);
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

    describe(`InspectedFieldAccess`, () => {
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
                    textUnderPosition: undefined,
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
                    textUnderPosition: "key",
                });
            });

            it(`[key with a space = 1][| key with a space`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][| key with a space`, {
                    fieldNames: [`key with a space`],
                    isAutocompleteAllowed: false,
                    textEditRange: undefined,
                    textUnderPosition: undefined,
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
                    textUnderPosition: `#"key with a space"`,
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
                    textUnderPosition: `#"key with a space"`,
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
                    textUnderPosition: `#"key with a space"`,
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
                    textUnderPosition: `#"key with a space"`,
                });
            });

            it(`[cat = 1, #"=requiredQuotedIdentifier" = 2][#"=requiredQuotedIdentifier"|]`, async () => {
                await expectInspectedFieldAccess(
                    `[cat = 1, #"=requiredQuotedIdentifier" = 2][#"=requiredQuotedIdentifier"|]`,
                    {
                        fieldNames: [`#"=requiredQuotedIdentifier"`],
                        isAutocompleteAllowed: true,
                        textEditRange: {
                            start: {
                                line: 0,
                                character: 44,
                            },
                            end: {
                                line: 0,
                                character: 72,
                            },
                        },
                        textUnderPosition: `#"=requiredQuotedIdentifier"`,
                    },
                );
            });
        });

        describe(`FieldProjection`, () => {
            it(`[key with a space = 1][ [|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [|`, {
                    fieldNames: [],
                    isAutocompleteAllowed: true,
                    textEditRange: undefined,
                    textUnderPosition: undefined,
                });
            });

            it(`[key with a space = 1][ [A]|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A]|`, {
                    fieldNames: ["A"],
                    isAutocompleteAllowed: false,
                    textEditRange: undefined,
                    textUnderPosition: undefined,
                });
            });

            it(`[key with a space = 1][ [A],|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A],|`, {
                    fieldNames: ["A"],
                    isAutocompleteAllowed: false,
                    textEditRange: undefined,
                    textUnderPosition: undefined,
                });
            });

            it(`[key with a space = 1][ [A], [|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A], [|`, {
                    fieldNames: ["A"],
                    isAutocompleteAllowed: true,
                    textEditRange: undefined,
                    textUnderPosition: undefined,
                });
            });

            it(`[key with a space = 1][ [A|], [B`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A|], [B`, {
                    fieldNames: ["A", "B"],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 25,
                        },
                        end: {
                            line: 0,
                            character: 26,
                        },
                    },
                    textUnderPosition: "A",
                });
            });

            it(`[key with a space = 1][ [A], [B|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A], [B|`, {
                    fieldNames: ["A", "B"],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 30,
                        },
                        end: {
                            line: 0,
                            character: 31,
                        },
                    },
                    textUnderPosition: "B",
                });
            });

            it(`let _ = [key with a space = 1][ [A], [B| in _ `, async () => {
                await expectInspectedFieldAccess(`[let _ = [key with a space = 1][ [A], [B| in _`, {
                    fieldNames: ["A", "B in _"],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 39,
                        },
                        end: {
                            line: 0,
                            character: 40,
                        },
                    },
                    textUnderPosition: "B",
                });
            });

            it(`[key with a space = 1][ [A], [|#"B"`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A], [|#"B"`, {
                    fieldNames: ["A", `#"B"`],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 30,
                        },
                        end: {
                            line: 0,
                            character: 34,
                        },
                    },
                    textUnderPosition: `#"B"`,
                });
            });

            it(`[key with a space = 1][ [A], [#"B"|`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A], [#"B"|`, {
                    fieldNames: ["A", `#"B"`],
                    isAutocompleteAllowed: true,
                    textEditRange: {
                        start: {
                            line: 0,
                            character: 30,
                        },
                        end: {
                            line: 0,
                            character: 34,
                        },
                    },
                    textUnderPosition: `#"B"`,
                });
            });

            it(`[key with a space = 1][ [A], [#"B" |`, async () => {
                await expectInspectedFieldAccess(`[key with a space = 1][ [A], [#"B" |`, {
                    fieldNames: ["A", `#"B"`],
                    isAutocompleteAllowed: false,
                    textEditRange: undefined,
                    textUnderPosition: undefined,
                });
            });
        });
    });

    describe(`top suggestions`, () => {
        describe(`FieldSelection`, () => {
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

            it(`[cat = 1, #"=requiredQuotedIdentifier" = 2][#"=requiredQuotedIdentifier"|]`, async () => {
                await expectTopFieldAccessReplacements(
                    `[cat = 1, #"=requiredQuotedIdentifier" = 2][#"=requiredQuotedIdentifier"|]`,
                    [`#"=requiredQuotedIdentifier"`, "cat"],
                );
            });
        });

        describe(`FieldSelection`, () => {
            it(`[][ [|`, () => expectNoFieldAccessSuggestions(`[][ [|`));

            it(`[][ [ |`, () => expectNoFieldAccessSuggestions(`[][ [ |`));

            it(`[car = 1, cat = 2][ [cat], [car|]`, () =>
                expectTopFieldAccessReplacements(`[car = 1, cat = 2][ [cat], [car|]`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][ [|`, () => expectTopFieldAccessInserts(`[car = 1, cat = 2][ [|`, [`car`, `cat`]));

            it(`[car = 1, cat = 2][ [|`, () => expectTopFieldAccessInserts(`[car = 1, cat = 2][ [|`, [`car`, `cat`]));

            it(`[key with a space = 1][ [|`, () =>
                expectTopFieldAccessInserts(`[key with a space = 1][ [|`, [`key with a space`]));

            it(`[key with a space = 1][ [key|`, () =>
                expectTopFieldAccessReplacements(`[key with a space = 1][ [key|`, [`key with a space`]));
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [car = 1, cat = 2] in fn()[|`, () =>
            expectTopFieldAccessInserts(`let fn = () => [car = 1, cat = 2] in fn()[|`, ["car", "cat"]));

        it(`let foo = () => [car = 1, cat = 2], bar = foo in bar()[|`, () =>
            expectTopFieldAccessInserts(`let foo = () => [car = 1, cat = 2], bar = foo in bar()[|`, ["car", "cat"]));

        it(`let foo = () => [car = 1, cat = 2], bar = () => foo in bar()()[|`, () =>
            expectTopFieldAccessInserts(`let foo = () => [car = 1, cat = 2], bar = () => foo in bar()()[|`, [
                "car",
                "cat",
            ]));

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, () =>
            expectTopFieldAccessInserts(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, [
                "car",
                "cat",
            ]));
    });
});
