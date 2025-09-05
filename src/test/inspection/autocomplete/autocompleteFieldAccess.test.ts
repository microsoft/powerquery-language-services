// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { ResultUtils, Task } from "@microsoft/powerquery-parser";

import { ActiveNode, ActiveNodeUtils } from "../../../powerquery-language-services/inspection";
import { expectNoSuggestions, expectSuggestions } from "../../testUtils/autocompleteTestUtils";
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

    async function expectNoFieldAccessSuggestions(textWithPipe: string): Promise<void> {
        await expectNoSuggestions({
            textWithPipe,
            autocompleteItemSelector: fieldAccessAutocompleteItemSelector,
        });
    }

    async function expectFieldAccessSuggestions(params: {
        readonly textWithPipe: string;
        readonly expected: {
            readonly labels: ReadonlyArray<string>;
            readonly isTextEdit: boolean;
        };
    }): Promise<void> {
        await expectSuggestions({
            textWithPipe: params.textWithPipe,
            expected: params.expected.labels.map((label: string) => ({
                label,
                isTextEdit: params.expected.isTextEdit,
            })),
            autocompleteItemSelector: fieldAccessAutocompleteItemSelector,
        });
    }

    describe(`InspectedFieldAccess`, () => {
        async function expectInspectedFieldAccess(
            textWithPipe: string,
            expected: Inspection.InspectedFieldAccess | undefined,
        ): Promise<void> {
            const [text, position]: [string, Position] = TestUtils.extractPosition(textWithPipe);

            const parsed: Task.ParseTaskOk | Task.ParseTaskParseError = await TestUtils.assertParse({
                text,
                settings: TestConstants.DefaultInspectionSettings,
            });

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

    describe(`expected labels`, () => {
        describe(`FieldSelection`, () => {
            it(`[][|`, async () => await expectNoFieldAccessSuggestions(`[][|`));

            it(`[][|`, async () => await expectNoFieldAccessSuggestions(`[][|`));

            it(`[][ |`, async () => await expectNoFieldAccessSuggestions(`[][ |`));

            it(`[car = 1, cat = 2][|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: false,
                    },
                }));

            it(`[car = 1, cat = 2][ |`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ |`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: false,
                    },
                }));

            it(`[car = 1, cat = 2][ | ]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ | ]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: false,
                    },
                }));

            it(`let foo = [car = 1, cat = 2][#"test"|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `let foo = [car = 1, cat = 2][#"test"|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][c|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][c|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][ca|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ca|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][car|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][car|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][cart|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][cart|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][c|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][c|]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][ca|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ca|]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][car|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][car|]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][cart|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][cart|]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][cart|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[cat = 1, #"=requiredQuotedIdentifier" = 2][#"=requiredQuotedIdentifier"|]`,
                    expected: {
                        labels: [`#"=requiredQuotedIdentifier"`, "cat"],
                        isTextEdit: true,
                    },
                }));
        });

        describe(`FieldSelection`, () => {
            it(`[][ [|`, async () => await expectNoFieldAccessSuggestions(`[][ [|`));

            it(`[][ [ |`, async () => await expectNoFieldAccessSuggestions(`[][ [ |`));

            it(`[car = 1, cat = 2][ [cat], [car|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ [cat], [car|]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][ [cat], [car|]`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ [cat], [car|]`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: true,
                    },
                }));

            it(`[car = 1, cat = 2][ [|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ [|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: false,
                    },
                }));

            it(`[car = 1, cat = 2][ [|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[car = 1, cat = 2][ [|`,
                    expected: {
                        labels: [`car`, `cat`],
                        isTextEdit: false,
                    },
                }));

            it(`[key with a space = 1][ [|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[key with a space = 1][ [|`,
                    expected: {
                        labels: [`key with a space`],
                        isTextEdit: false,
                    },
                }));

            it(`[key with a space = 1][ [key|`, async () =>
                await expectFieldAccessSuggestions({
                    textWithPipe: `[key with a space = 1][ [key|`,
                    expected: {
                        labels: [`key with a space`],
                        isTextEdit: true,
                    },
                }));
        });
    });

    describe(`Indirection`, () => {
        it(`let fn = () => [car = 1, cat = 2] in fn()[|`, async () =>
            await expectFieldAccessSuggestions({
                textWithPipe: `let fn = () => [car = 1, cat = 2] in fn()[|`,
                expected: {
                    labels: ["car", "cat"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = () => [car = 1, cat = 2], bar = foo in bar()[|`, async () =>
            await expectFieldAccessSuggestions({
                textWithPipe: `let foo = () => [car = 1, cat = 2], bar = foo in bar()[|`,
                expected: {
                    labels: ["car", "cat"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = () => [car = 1, cat = 2], bar = () => foo in bar()()[|`, async () =>
            await expectFieldAccessSuggestions({
                textWithPipe: `let foo = () => [car = 1, cat = 2], bar = () => foo in bar()()[|`,
                expected: {
                    labels: ["car", "cat"],
                    isTextEdit: false,
                },
            }));

        it(`let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`, async () =>
            await expectFieldAccessSuggestions({
                textWithPipe: `let foo = () => if true then [cat = 1] else [car = 2] in foo()[|`,
                expected: {
                    labels: ["car", "cat"],
                    isTextEdit: false,
                },
            }));
    });
});
