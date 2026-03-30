// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, ICancellationToken, Result, ResultUtils } from "@microsoft/powerquery-parser";
import { FoldingRange, SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver-types";
import type { Range } from "vscode-languageserver-textdocument";

import {
    Analysis,
    AnalysisSettings,
    Inspection,
    Library,
    NullSymbolProvider,
    PartialSemanticToken,
    Position,
    SignatureHelp,
    TypeStrategy,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { AutocompleteItem } from "../../powerquery-language-services/inspection";
import { expect } from "chai";

describe(`SimpleLocalDocumentSymbolProvider`, () => {
    const IsolatedAnalysisSettings: AnalysisSettings = {
        ...TestConstants.SimpleLibraryAnalysisSettings,
        languageAutocompleteItemProviderFactory: () => NullSymbolProvider.singleton(),
        libraryProviderFactory: (_library: Library.ILibrary) => NullSymbolProvider.singleton(),
    };

    const DirectiveHoverAnalysisSettings: AnalysisSettings = {
        ...IsolatedAnalysisSettings,
        inspectionSettings: {
            ...IsolatedAnalysisSettings.inspectionSettings,
            isTypeDirectiveAllowed: true,
            typeStrategy: TypeStrategy.Primitive,
        },
    };

    async function runTest(params: {
        readonly textWithPipe: string;
        readonly expected: {
            readonly labels: ReadonlyArray<string>;
            readonly isTextEdit: boolean;
        };
        readonly cancellationToken?: ICancellationToken;
    }): Promise<void> {
        const actual: ReadonlyArray<AutocompleteItem> | undefined = await TestUtils.assertAutocompleteAnalysis({
            ...params,
            analysisSettings: IsolatedAnalysisSettings,
        });

        TestUtils.assertEqualAbridgedAutocompleteItems({
            expected: params.expected.labels.map((label: string) => ({
                label,
                isTextEdit: params.expected.isTextEdit,
            })),
            actual: (actual ?? []).map(TestUtils.abridgedAutocompleteItem),
        });
    }

    async function runDirectiveAutocompleteTest(params: {
        readonly textWithPipe: string;
        readonly expected: {
            readonly labels: ReadonlyArray<string>;
            readonly isTextEdit: boolean;
        };
        readonly unexpectedLabels?: ReadonlyArray<string>;
        readonly cancellationToken?: ICancellationToken;
    }): Promise<void> {
        const actual: ReadonlyArray<AutocompleteItem> | undefined = await TestUtils.assertAutocompleteAnalysis({
            ...params,
            analysisSettings: DirectiveHoverAnalysisSettings,
        });

        const abridgedAutocompleteItems: ReadonlyArray<ReturnType<typeof TestUtils.abridgedAutocompleteItem>> = (
            actual ?? []
        ).map(TestUtils.abridgedAutocompleteItem);

        expect(abridgedAutocompleteItems).to.include.deep.members(
            params.expected.labels.map((label: string) => ({
                label,
                isTextEdit: params.expected.isTextEdit,
            })),
        );

        if (params.unexpectedLabels?.length) {
            expect(
                abridgedAutocompleteItems.map(
                    (item: ReturnType<typeof TestUtils.abridgedAutocompleteItem>) => item.label,
                ),
            ).not.to.include.members(params.unexpectedLabels);
        }
    }

    describe(`getAutocompleteItems`, () => {
        describe(`scope`, () => {
            describe(`${Inspection.ScopeItemKind.LetVariable}`, () => {
                it(`match all`, async () =>
                    await runTest({
                        textWithPipe: `let foo = 1, bar = 2, foobar = 3 in |`,
                        expected: {
                            labels: [
                                `foo`,
                                `@foo`,
                                `#"foo"`,
                                `@#"foo"`,
                                `bar`,
                                `@bar`,
                                `#"bar"`,
                                `@#"bar"`,
                                `foobar`,
                                `@foobar`,
                                `#"foobar"`,
                                `@#"foobar"`,
                            ],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, async () =>
                    await runTest({
                        textWithPipe: `let foo = 1, bar = 2, foobar = 3 in foo|`,
                        expected: {
                            labels: [
                                `foo`,
                                `@foo`,
                                `#"foo"`,
                                `@#"foo"`,
                                `bar`,
                                `@bar`,
                                `#"bar"`,
                                `@#"bar"`,
                                `foobar`,
                                `@foobar`,
                                `#"foobar"`,
                                `@#"foobar"`,
                            ],
                            isTextEdit: true,
                        },
                    }));
            });

            describe(`${Inspection.ScopeItemKind.Parameter}`, () => {
                it(`match all`, async () =>
                    await runTest({
                        textWithPipe: `(foo, bar, foobar) => |`,
                        expected: {
                            labels: [`foo`, `#"foo"`, `bar`, `#"bar"`, `foobar`, `#"foobar"`],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, async () =>
                    await runTest({
                        textWithPipe: `(foo, bar, foobar) => foo|`,
                        expected: {
                            labels: [`foo`, `#"foo"`, `bar`, `#"bar"`, `foobar`, `#"foobar"`],
                            isTextEdit: true,
                        },
                    }));
            });

            describe(`${Inspection.ScopeItemKind.RecordField}`, () => {
                it(`match all`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3, x = |][`,
                        expected: {
                            labels: [
                                `foo`,
                                `@foo`,
                                `#"foo"`,
                                `@#"foo"`,
                                `bar`,
                                `@bar`,
                                `#"bar"`,
                                `@#"bar"`,
                                `foobar`,
                                `@foobar`,
                                `#"foobar"`,
                                `@#"foobar"`,
                                `@x`,
                                `@#"x"`,
                            ],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3, x = foo|`,
                        expected: {
                            labels: [
                                `foo`,
                                `@foo`,
                                `#"foo"`,
                                `@#"foo"`,
                                `bar`,
                                `@bar`,
                                `#"bar"`,
                                `@#"bar"`,
                                `foobar`,
                                `@foobar`,
                                `#"foobar"`,
                                `@#"foobar"`,
                                `@x`,
                                `@#"x"`,
                            ],
                            isTextEdit: true,
                        },
                    }));
            });

            describe(`${Inspection.ScopeItemKind.SectionMember}`, () => {
                it(`match all`, async () =>
                    await runTest({
                        textWithPipe: `section; foo = 1; bar = 2; foobar = 3; x = |`,
                        expected: {
                            labels: [
                                `foo`,
                                `@foo`,
                                `#"foo"`,
                                `@#"foo"`,
                                `bar`,
                                `@bar`,
                                `#"bar"`,
                                `@#"bar"`,
                                `foobar`,
                                `@foobar`,
                                `#"foobar"`,
                                `@#"foobar"`,
                                `@x`,
                                `@#"x"`,
                            ],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, async () =>
                    await runTest({
                        textWithPipe: `section; foo = 1; bar = 2; foobar = 3; x = foo|`,
                        expected: {
                            labels: [
                                `foo`,
                                `@foo`,
                                `#"foo"`,
                                `@#"foo"`,
                                `bar`,
                                `@bar`,
                                `#"bar"`,
                                `@#"bar"`,
                                `foobar`,
                                `@foobar`,
                                `#"foobar"`,
                                `@#"foobar"`,
                                `@x`,
                                `@#"x"`,
                            ],
                            isTextEdit: true,
                        },
                    }));
            });
        });

        describe(`fieldAccess`, () => {
            describe(`fieldProjection`, () => {
                it(`match all`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][[foo|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: true,
                        },
                    }));

                it(`no repeats`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][[foo], [|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: false,
                        },
                    }));
            });

            describe(`fieldSelection`, () => {
                it(`match all`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, async () =>
                    await runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][foo|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: true,
                        },
                    }));
            });
        });

        describe(`directive record fields`, () => {
            it(`feature disabled`, async () => {
                const actual: ReadonlyArray<AutocompleteItem> | undefined = await TestUtils.assertAutocompleteAnalysis({
                    textWithPipe: `let
    /// @type [ Foo = text, Bar = number ]
    value = [
        |
    ]
in
    value`,
                    analysisSettings: IsolatedAnalysisSettings,
                });

                expect((actual ?? []).map((item: AutocompleteItem) => item.label)).not.to.include.members([
                    `Foo`,
                    `Bar`,
                ]);
            });

            it(`let-variable record expression`, async () =>
                await runDirectiveAutocompleteTest({
                    textWithPipe: `let
    /// @type [ Foo = text, Bar = number ]
    value = [
        |
    ]
in
    value`,
                    expected: {
                        labels: [`Foo`, `Bar`],
                        isTextEdit: false,
                    },
                }));

            it(`section-member record expression`, async () =>
                await runDirectiveAutocompleteTest({
                    textWithPipe: `section foo;

/// @type [ optional Beta = logical, optional Category = text, optional ButtonText = {text}, optional LearnMoreUrl = text ]
OAuthError.Publish = [
    |
];`,
                    expected: {
                        labels: [`Beta`, `Category`, `ButtonText`, `LearnMoreUrl`],
                        isTextEdit: false,
                    },
                }));

            it(`section-member record expression after dangling comma`, async () =>
                await runDirectiveAutocompleteTest({
                    textWithPipe: `section foo;

/// @type [ optional Beta = logical, optional Category = text, optional ButtonText = {text}, optional LearnMoreUrl = text ]
OAuthError.Publish = [
    Beta = false,
    |
];`,
                    expected: {
                        labels: [`Category`, `ButtonText`, `LearnMoreUrl`],
                        isTextEdit: false,
                    },
                    unexpectedLabels: [`Beta`],
                }));

            it(`let-variable record expression excludes existing fields`, async () =>
                await runDirectiveAutocompleteTest({
                    textWithPipe: `let
    /// @type [ Foo = text, Bar = number, Baz = logical ]
    value = [
        Foo = "x",
        |
    ]
in
    value`,
                    expected: {
                        labels: [`Bar`, `Baz`],
                        isTextEdit: false,
                    },
                    unexpectedLabels: [`Foo`],
                }));

            it(`section-member field access`, async () =>
                await runDirectiveAutocompleteTest({
                    textWithPipe: `section foo;

/// @type [ optional Beta = logical, optional Category = text, optional ButtonText = {text}, optional LearnMoreUrl = text ]
OAuthError.Publish = [];

other = OAuthError.Publish[|];`,
                    expected: {
                        labels: [`Beta`, `Category`, `ButtonText`, `LearnMoreUrl`],
                        isTextEdit: false,
                    },
                }));
        });
    });

    describe(`getDefinition`, () => {
        async function assertDefinition(params: {
            readonly textWithPipe: string;
            readonly expected: Range[] | undefined;
            readonly cancellationToken?: ICancellationToken;
        }): Promise<void> {
            await TestUtils.assertEqualDefinitionAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        it(`no definition`, async () =>
            await assertDefinition({
                textWithPipe: `let foo = 1 in baz|`,
                expected: undefined,
            }));

        it(`let expression`, async () =>
            await assertDefinition({
                textWithPipe: `let foobar = 1 in foobar|`,
                expected: [
                    {
                        end: { character: 10, line: 0 },
                        start: { character: 4, line: 0 },
                    },
                ],
            }));

        it(`record expression`, async () =>
            await assertDefinition({
                textWithPipe: `[foo = 1, bar = foo|]`,
                expected: [
                    {
                        end: { character: 4, line: 0 },
                        start: { character: 1, line: 0 },
                    },
                ],
            }));

        it(`record expression, not on key`, async () =>
            await assertDefinition({
                textWithPipe: `[foo = 1, bar = [foo| = 2]]`,
                expected: undefined,
            }));

        it(`section expression`, async () =>
            await assertDefinition({
                textWithPipe: `section foo; bar = 1; baz = bar|`,
                expected: [
                    {
                        end: { character: 16, line: 0 },
                        start: { character: 13, line: 0 },
                    },
                ],
            }));

        it(`parameter`, async () =>
            await assertDefinition({
                textWithPipe: `(foo as number) => foo|`,
                expected: [
                    {
                        end: { character: 4, line: 0 },
                        start: { character: 1, line: 0 },
                    },
                ],
            }));
    });

    describe(`getFoldingRanges`, () => {
        async function assertFoldingRanges(params: {
            readonly text: string;
            readonly expected: FoldingRange[];
        }): Promise<void> {
            await TestUtils.assertEqualFoldingRangesAnalysis({
                ...params,
                analysisSettings: TestConstants.SimpleLibraryAnalysisSettings,
            });
        }

        it(`LetExpression`, async () =>
            await assertFoldingRanges({
                text: `let \n foo = 1 \n in \n baz`,
                expected: [
                    {
                        endCharacter: 4,
                        endLine: 3,
                        startCharacter: 0,
                        startLine: 0,
                    },
                ],
            }));

        it(`MetaExpression`, async () =>
            await assertFoldingRanges({
                text: `1 meta [ \n foo = number \n ]`,
                expected: [
                    {
                        endCharacter: 2,
                        endLine: 2,
                        startCharacter: 0,
                        startLine: 0,
                    },
                    {
                        endCharacter: 2,
                        endLine: 2,
                        startCharacter: 7,
                        startLine: 0,
                    },
                ],
            }));

        it(`RecordExpression`, async () =>
            await assertFoldingRanges({
                text: `[ \n a=1, \n b=2 \n ]`,
                expected: [
                    {
                        endCharacter: 2,
                        endLine: 3,
                        startCharacter: 0,
                        startLine: 0,
                    },
                ],
            }));

        it(`RecordLiteral`, async () =>
            await assertFoldingRanges({
                text: `[ \n a=1, \n b=2 \n ] \n section foo; bar = 1`,
                expected: [
                    {
                        endCharacter: 2,
                        endLine: 3,
                        startCharacter: 0,
                        startLine: 0,
                    },
                ],
            }));

        it(`SectionMember`, async () =>
            await assertFoldingRanges({
                text: `[ \n a=1, \n b=2 \n ] \n section foo; bar = \n let \n foo = 1 \n in \n 1`,
                expected: [
                    {
                        endCharacter: 2,
                        endLine: 8,
                        startCharacter: 1,
                        startLine: 5,
                    },
                    {
                        endCharacter: 2,
                        endLine: 3,
                        startCharacter: 0,
                        startLine: 0,
                    },
                ],
            }));
    });

    describe(`getHover`, () => {
        async function assertHover(params: {
            readonly textWithPipe: string;
            readonly expected: string | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualHoverAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        describe(`simple`, () => {
            it(`let-variable`, async () =>
                await assertHover({
                    textWithPipe: `let x = 1 in x|`,
                    expected: `[let-variable] x: 1`,
                }));

            it(`parameter`, async () =>
                await assertHover({
                    textWithPipe: `(x as number) => x|`,
                    expected: `[parameter] x: number`,
                }));

            it(`record-field`, async () =>
                await assertHover({
                    textWithPipe: `[x = 1, y = x|]`,
                    expected: `[record-field] x: 1`,
                }));

            it(`section-member`, async () =>
                await assertHover({
                    textWithPipe: `section; x = 1; y = x|;`,
                    expected: `[section-member] x: 1`,
                }));

            it(`undefined`, async () =>
                await assertHover({
                    textWithPipe: `x|`,
                    expected: undefined,
                }));

            it(`undefined on parameter hover`, async () =>
                await assertHover({
                    textWithPipe: `let foo = 10, bar = (foo| as number) => foo in foo`,
                    expected: undefined,
                }));
        });

        describe(`hover the value when over key`, () => {
            it(`let-variable`, async () =>
                await assertHover({
                    textWithPipe: `let foo| = 1 in foo`,
                    expected: `[let-variable] foo: 1`,
                }));

            it(`record-field expression`, async () =>
                await assertHover({
                    textWithPipe: `[foo| = 1]`,
                    expected: `[record-field] foo: 1`,
                }));

            it(`record-field literal`, async () =>
                await assertHover({
                    textWithPipe: `[foo| = 1] section; bar = 1;`,
                    expected: `[record-field] foo: 1`,
                }));

            it(`section-member`, async () =>
                await assertHover({
                    textWithPipe: `section; foo| = 1;`,
                    expected: `[section-member] foo: 1`,
                }));
        });

        describe(`directive hover`, () => {
            it(`disabled`, async () =>
                await assertHover({
                    textWithPipe: `let
    /// @type [ Foo = text, Bar = number ]
    value = []
in
    value|`,
                    expected: `[let-variable] value: []`,
                }));

            it(`let-variable`, async () =>
                await TestUtils.assertEqualHoverAnalysis({
                    analysisSettings: DirectiveHoverAnalysisSettings,
                    textWithPipe: `let
    /// @type [ Foo = text, Bar = number ]
    value = []
in
    value|`,
                    expected: `[let-variable] value: type [Foo: text, Bar: number] (via @type directive)`,
                }));

            it(`section-member`, async () =>
                await TestUtils.assertEqualHoverAnalysis({
                    analysisSettings: DirectiveHoverAnalysisSettings,
                    textWithPipe: `section foo;

/// @type [ optional Beta = logical, optional Category = text, optional ButtonText = {text}, optional LearnMoreUrl = text ]
OAuthError.Publish| = [

];`,
                    expected: `[section-member] OAuthError.Publish: type [ optional Beta = logical, optional Category = text, optional ButtonText = {text}, optional LearnMoreUrl = text ] (via @type directive)`,
                }));

            it(`section-member reference`, async () =>
                await TestUtils.assertEqualHoverAnalysis({
                    analysisSettings: DirectiveHoverAnalysisSettings,
                    textWithPipe: `section foo;

/// @type [ optional Beta = logical ]
OAuthError.Publish = [];

other = OAuthError.Publish|;`,
                    expected: `[section-member] OAuthError.Publish: type [Beta: logical] (via @type directive)`,
                }));
        });
    });

    describe(`getPartialSemanticTokens`, () => {
        async function assertSemanticTokens(params: {
            readonly text: string;
            readonly expected: ReadonlyArray<PartialSemanticToken> | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualPartialSemanticTokensAnalysis({
                ...params,
                analysisSettings: IsolatedAnalysisSettings,
            });
        }

        it(`field projection`, async () =>
            await assertSemanticTokens({
                text: `a[[b]]?`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 3, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                    {
                        range: {
                            end: { character: 7, line: 0 },
                            start: { character: 6, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.operator,
                    },
                    {
                        range: {
                            end: { character: 1, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`field selector`, async () =>
            await assertSemanticTokens({
                text: `a[b]?`,
                expected: [
                    {
                        range: {
                            end: { character: 3, line: 0 },
                            start: { character: 2, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                    {
                        range: {
                            end: { character: 5, line: 0 },
                            start: { character: 4, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.operator,
                    },
                    {
                        range: {
                            end: { character: 1, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`numeric literal`, async () =>
            await assertSemanticTokens({
                text: `1`,
                expected: [
                    {
                        range: {
                            end: { character: 1, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                ],
            }));

        it(`nullable primitive type`, async () =>
            await assertSemanticTokens({
                text: `1 is nullable number`,
                expected: [
                    {
                        range: {
                            end: { character: 1, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                    {
                        range: {
                            end: { character: 13, line: 0 },
                            start: { character: 5, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 20, line: 0 },
                            start: { character: 14, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.type,
                    },
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 2, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                ],
            }));

        it(`primitive type`, async () =>
            await assertSemanticTokens({
                text: `text`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`parameter`, async () =>
            await assertSemanticTokens({
                text: `(optional foo as number) => foo`,
                expected: [
                    {
                        range: {
                            end: { character: 16, line: 0 },
                            start: { character: 14, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 9, line: 0 },
                            start: { character: 1, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 13, line: 0 },
                            start: { character: 10, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration],
                        tokenType: SemanticTokenTypes.parameter,
                    },
                    {
                        range: {
                            end: { character: 23, line: 0 },
                            start: { character: 17, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.type,
                    },
                    {
                        range: {
                            end: { character: 31, line: 0 },
                            start: { character: 28, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`record literal`, async () =>
            await assertSemanticTokens({
                text: `[foo = 1]section bar;`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 1, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
                        tokenType: SemanticTokenTypes.variable,
                    },
                    {
                        range: {
                            end: { character: 8, line: 0 },
                            start: { character: 7, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                ],
            }));

        it(`record expression`, async () =>
            await assertSemanticTokens({
                text: `[foo = 1]`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 1, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
                        tokenType: SemanticTokenTypes.variable,
                    },
                    {
                        range: {
                            end: { character: 8, line: 0 },
                            start: { character: 7, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                ],
            }));

        it(`record with function value`, async () =>
            await assertSemanticTokens({
                text: `[fn = (x) => x]`,
                expected: [
                    {
                        range: {
                            end: { character: 3, line: 0 },
                            start: { character: 1, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
                        tokenType: SemanticTokenTypes.function,
                    },
                    {
                        range: {
                            end: { character: 8, line: 0 },
                            start: { character: 7, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration],
                        tokenType: SemanticTokenTypes.parameter,
                    },
                    {
                        range: {
                            end: { character: 14, line: 0 },
                            start: { character: 13, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`each expression`, async () =>
            await assertSemanticTokens({
                text: `each 1`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 6, line: 0 },
                            start: { character: 5, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                ],
            }));

        it(`let expression`, async () =>
            await assertSemanticTokens({
                text: `let x = 1 in x`,
                expected: [
                    {
                        range: {
                            end: { character: 5, line: 0 },
                            start: { character: 4, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
                        tokenType: SemanticTokenTypes.variable,
                    },
                    {
                        range: {
                            end: { character: 3, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 12, line: 0 },
                            start: { character: 10, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 9, line: 0 },
                            start: { character: 8, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                    {
                        range: {
                            end: { character: 14, line: 0 },
                            start: { character: 13, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`if expression`, async () =>
            await assertSemanticTokens({
                text: `if true then 1 else 2`,
                expected: [
                    {
                        range: {
                            end: { character: 2, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 12, line: 0 },
                            start: { character: 8, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 19, line: 0 },
                            start: { character: 15, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 7, line: 0 },
                            start: { character: 3, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 14, line: 0 },
                            start: { character: 13, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                    {
                        range: {
                            end: { character: 21, line: 0 },
                            start: { character: 20, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                ],
            }));

        it(`logical literal true`, async () =>
            await assertSemanticTokens({
                text: `true`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                ],
            }));

        it(`logical literal false`, async () =>
            await assertSemanticTokens({
                text: `false`,
                expected: [
                    {
                        range: {
                            end: { character: 5, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                ],
            }));

        it(`null literal`, async () =>
            await assertSemanticTokens({
                text: `null`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                ],
            }));

        it(`function definition vs variable`, async () =>
            await assertSemanticTokens({
                text: `let fn = (x) => x in fn(1)`,
                expected: [
                    {
                        range: {
                            end: { character: 6, line: 0 },
                            start: { character: 4, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
                        tokenType: SemanticTokenTypes.function,
                    },
                    {
                        range: {
                            end: { character: 23, line: 0 },
                            start: { character: 21, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.function,
                    },
                    {
                        range: {
                            end: { character: 3, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 20, line: 0 },
                            start: { character: 18, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 25, line: 0 },
                            start: { character: 24, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                    {
                        range: {
                            end: { character: 11, line: 0 },
                            start: { character: 10, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration],
                        tokenType: SemanticTokenTypes.parameter,
                    },
                    {
                        range: {
                            end: { character: 17, line: 0 },
                            start: { character: 16, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                    {
                        range: {
                            end: { character: 23, line: 0 },
                            start: { character: 21, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ],
            }));

        it(`table type`, async () =>
            await assertSemanticTokens({
                text: `type table [optional foo = nullable number]`,
                expected: [
                    {
                        range: {
                            end: { character: 20, line: 0 },
                            start: { character: 12, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 35, line: 0 },
                            start: { character: 27, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.keyword,
                    },
                    {
                        range: {
                            end: { character: 42, line: 0 },
                            start: { character: 36, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.type,
                    },
                    {
                        range: {
                            end: { character: 10, line: 0 },
                            start: { character: 5, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.type,
                    },
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.type,
                    },
                ],
            }));

        it(`text literal`, async () =>
            await assertSemanticTokens({
                text: `""`,
                expected: [
                    {
                        range: {
                            end: { character: 2, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.string,
                    },
                ],
            }));

        it(`non-parsable text returns undefined`, async () =>
            await assertSemanticTokens({
                text: `"`,
                expected: undefined,
            }));
    });

    describe(`getSignatureHelp`, () => {
        async function assertSignatureHelp(params: {
            readonly textWithPipe: string;
            readonly expected: SignatureHelp | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualSignatureHelpAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        async function assertDirectiveSignatureHelp(params: {
            readonly textWithPipe: string;
            readonly expected: SignatureHelp | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualSignatureHelpAnalysis({
                ...params,
                analysisSettings: DirectiveHoverAnalysisSettings,
            });
        }

        it(`no closing bracket`, async () =>
            await assertSignatureHelp({
                textWithPipe: `let fn = (x as number, y as number) => x + y in fn(1|`,
                expected: {
                    activeParameter: 0,
                    activeSignature: 0,
                    signatures: [
                        {
                            label: `fn(x: number, y: number)`,
                            parameters: [
                                {
                                    label: `x`,
                                },
                                {
                                    label: `y`,
                                },
                            ],
                        },
                    ],
                },
            }));

        it(`closing bracket`, async () =>
            await assertSignatureHelp({
                textWithPipe: `let fn = (x as number, y as number) => x + y in fn(1|)`,
                expected: {
                    activeParameter: 0,
                    activeSignature: 0,
                    signatures: [
                        {
                            label: `fn(x: number, y: number)`,
                            parameters: [
                                {
                                    label: `x`,
                                },
                                {
                                    label: `y`,
                                },
                            ],
                        },
                    ],
                },
            }));

        it(`directive-backed function type`, async () =>
            await assertDirectiveSignatureHelp({
                textWithPipe: `let
    /// @type type function (message as text, optional code as nullable number) as text
    fn = (message as any, optional code as any) => message
in
    fn(|)`,
                expected: {
                    activeParameter: 0,
                    activeSignature: 0,
                    signatures: [
                        {
                            label: `fn(message: text, code: optional nullable number)`,
                            parameters: [
                                {
                                    label: `message`,
                                },
                                {
                                    label: `code`,
                                },
                            ],
                        },
                    ],
                },
            }));
    });

    describe(`.pq tests`, () => {
        it(`DirectQueryForSQL file`, async () => {
            const position: Position = {
                line: 40,
                character: 25,
            };

            const analysis: Analysis = TestUtils.assertAnalysisFromText({
                text: TestUtils.readFile(`DirectQueryForSQL.pq`),
                analysisSettings: IsolatedAnalysisSettings,
            });

            const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await analysis.getAutocompleteItems(position);

            const expected: string[] = [
                `ConnectionString`,
                `Credential`,
                `CredentialConnectionString`,
                `Database`,
                `DirectSQL`,
                `DirectSQL.UI`,
                `DirectSQL.Icons`,
                `server`,
                `database`,
            ];

            ResultUtils.assertIsOk(actual);
            Assert.isDefined(actual.value);

            const actualLabels: ReadonlyArray<string> = actual.value.map(
                (item: Inspection.AutocompleteItem) => item.label,
            );

            expect(actualLabels).to.include.members(expected);
        });
    });
});
