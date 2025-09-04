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

    function runTest(params: {
        readonly textWithPipe: string;
        readonly expected: {
            readonly labels: ReadonlyArray<string>;
            readonly isTextEdit: boolean;
        };
        readonly cancellationToken?: ICancellationToken;
    }): Promise<AutocompleteItem[] | undefined> {
        return TestUtils.assertAutocompleteAnalysis({
            ...params,
            analysisSettings: IsolatedAnalysisSettings,
        });
    }

    describe(`getAutocompleteItems`, () => {
        describe(`scope`, () => {
            describe(`${Inspection.ScopeItemKind.LetVariable}`, () => {
                it(`match all`, () =>
                    runTest({
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

                it(`match some`, () =>
                    runTest({
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
                            isTextEdit: false,
                        },
                    }));
            });

            describe(`${Inspection.ScopeItemKind.Parameter}`, () => {
                it(`match all`, () =>
                    runTest({
                        textWithPipe: `(foo, bar, foobar) => |`,
                        expected: {
                            labels: [`foo`, `#"foo"`, `bar`, `#"bar"`, `foobar`, `#"foobar"`],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, () =>
                    runTest({
                        textWithPipe: `(foo, bar, foobar) => foo|`,
                        expected: {
                            labels: [`foo`, `#"foo"`, `bar`, `#"bar"`, `foobar`, `#"foobar"`],
                            isTextEdit: false,
                        },
                    }));
            });

            describe(`${Inspection.ScopeItemKind.RecordField}`, () => {
                it(`match all`, () =>
                    runTest({
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

                it(`match some`, () =>
                    runTest({
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
                            isTextEdit: false,
                        },
                    }));
            });

            describe(`${Inspection.ScopeItemKind.SectionMember}`, () => {
                it(`match all`, () =>
                    runTest({
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

                it(`match some`, () =>
                    runTest({
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
                            isTextEdit: false,
                        },
                    }));
            });
        });

        describe(`fieldAccess`, () => {
            describe(`fieldProjection`, () => {
                it(`match all`, () =>
                    runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, () =>
                    runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][[foo|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: true,
                        },
                    }));

                xit(`no repeats`, () =>
                    runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][[foo], [|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: false,
                        },
                    }));
            });

            describe(`fieldSelection`, () => {
                it(`match all`, () =>
                    runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: false,
                        },
                    }));

                it(`match some`, () =>
                    runTest({
                        textWithPipe: `[foo = 1, bar = 2, foobar = 3][foo|`,
                        expected: {
                            labels: [`foo`, `bar`, `foobar`],
                            isTextEdit: true,
                        },
                    }));
            });
        });
    });

    describe(`getDefinition`, () => {
        function assertDefinition(params: {
            readonly textWithPipe: string;
            readonly expected: Range[] | undefined;
            readonly cancellationToken?: ICancellationToken;
        }): Promise<void> {
            return TestUtils.assertEqualDefinitionAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        it(`no definition`, () => assertDefinition({ textWithPipe: `let foo = 1 in baz|`, expected: undefined }));

        it(`let expression`, () =>
            assertDefinition({
                textWithPipe: `let foobar = 1 in foobar|`,
                expected: [
                    {
                        end: { character: 10, line: 0 },
                        start: { character: 4, line: 0 },
                    },
                ],
            }));

        it(`record expression`, () =>
            assertDefinition({
                textWithPipe: `[foo = 1, bar = foo|]`,
                expected: [
                    {
                        end: { character: 4, line: 0 },
                        start: { character: 1, line: 0 },
                    },
                ],
            }));

        it(`record expression, not on key`, () =>
            assertDefinition({
                textWithPipe: `[foo = 1, bar = [foo| = 2]]`,
                expected: undefined,
            }));

        it(`section expression`, () =>
            assertDefinition({
                textWithPipe: `section foo; bar = 1; baz = bar|`,
                expected: [
                    {
                        end: { character: 16, line: 0 },
                        start: { character: 13, line: 0 },
                    },
                ],
            }));

        it(`parameter`, () =>
            assertDefinition({
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
        function assertFoldingRanges(params: {
            readonly text: string;
            readonly expected: FoldingRange[];
        }): Promise<void> {
            return TestUtils.assertEqualFoldingRangesAnalysis({
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
        function assertHover(params: {
            readonly textWithPipe: string;
            readonly expected: string | undefined;
        }): Promise<void> {
            return TestUtils.assertEqualHoverAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        describe(`simple`, () => {
            it(`let-variable`, () => assertHover({ textWithPipe: `let x = 1 in x|`, expected: `[let-variable] x: 1` }));

            it(`parameter`, () =>
                assertHover({ textWithPipe: `(x as number) => x|`, expected: `[parameter] x: number` }));

            it(`record-field`, () => assertHover({ textWithPipe: `[x = 1, y = x|]`, expected: `[record-field] x: 1` }));

            it(`section-member`, () =>
                assertHover({ textWithPipe: `section; x = 1; y = x|;`, expected: `[section-member] x: 1` }));

            it(`undefined`, () => assertHover({ textWithPipe: `x|`, expected: undefined }));

            it(`undefined on parameter hover`, () =>
                assertHover({
                    textWithPipe: `let foo = 10, bar = (foo| as number) => foo in foo`,
                    expected: undefined,
                }));
        });

        describe(`hover the value when over key`, () => {
            it(`let-variable`, () =>
                assertHover({ textWithPipe: `let foo| = 1 in foo`, expected: `[let-variable] foo: 1` }));

            it(`record-field expression`, () =>
                assertHover({ textWithPipe: `[foo| = 1]`, expected: `[record-field] foo: 1` }));

            it(`record-field literal`, () =>
                assertHover({
                    textWithPipe: `[foo| = 1] section; bar = 1;`,
                    expected: `[record-field] foo: 1`,
                }));

            it(`section-member`, () =>
                assertHover({ textWithPipe: `section; foo| = 1;`, expected: `[section-member] foo: 1` }));
        });
    });

    describe(`getPartialSemanticTokens`, () => {
        function assertSemanticTokens(params: {
            readonly text: string;
            readonly expected: ReadonlyArray<PartialSemanticToken> | undefined;
        }): Promise<void> {
            return TestUtils.assertEqualPartialSemanticTokensAnalysis({
                ...params,
                analysisSettings: IsolatedAnalysisSettings,
            });
        }

        it(`field projection`, () =>
            assertSemanticTokens({
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

        it(`field selector`, () =>
            assertSemanticTokens({
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

        it(`numeric literal`, () =>
            assertSemanticTokens({
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

        it(`nullable primitive type`, () =>
            assertSemanticTokens({
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

        it(`primitive type`, () =>
            assertSemanticTokens({
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

        it(`parameter`, () =>
            assertSemanticTokens({
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

        it(`record literal`, () =>
            assertSemanticTokens({
                text: `[foo = 1]section bar;`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 1, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration],
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

        it(`record expression`, () =>
            assertSemanticTokens({
                text: `[foo = 1]`,
                expected: [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 1, line: 0 },
                        },
                        tokenModifiers: [SemanticTokenModifiers.declaration],
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

        it(`table type`, () =>
            assertSemanticTokens({
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

        it(`text literal`, () =>
            assertSemanticTokens({
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
            await assertSemanticTokens({ text: `"`, expected: undefined }));
    });

    describe(`getSignatureHelp`, () => {
        async function assertSignatureHelp(params: {
            readonly textWithPipe: string;
            readonly expected: SignatureHelp | undefined;
        }): Promise<void> {
            await TestUtils.assertEqualSignatureHelpAnalysis({ ...params, analysisSettings: IsolatedAnalysisSettings });
        }

        it(`no closing bracket`, () =>
            assertSignatureHelp({
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

        it(`closing bracket`, () =>
            assertSignatureHelp({
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
