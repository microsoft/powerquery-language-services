// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";
import { FoldingRange, Location, SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver-types";
import type { Range, TextDocument } from "vscode-languageserver-textdocument";
import { expect } from "chai";

import {
    AnalysisSettings,
    AnalysisUtils,
    Inspection,
    Library,
    NullSymbolProvider,
    PartialSemanticToken,
    Position,
    SignatureHelp,
} from "../../powerquery-language-services";
import { TestConstants, TestUtils } from "..";
import { MockDocument } from "../mockDocument";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

const IsolatedAnalysisSettings: AnalysisSettings = {
    ...TestConstants.SimpleLibraryAnalysisSettings,
    languageAutocompleteItemProviderFactory: () => NullSymbolProvider.singleton(),
    libraryProviderFactory: (_library: Library.ILibrary) => NullSymbolProvider.singleton(),
};

describe(`SimpleLocalDocumentSymbolProvider`, () => {
    async function assertAutocompleteItems(text: string, expected: ReadonlyArray<string>): Promise<void> {
        await TestUtils.assertEqualAutocomplete(expected, IsolatedAnalysisSettings, text);
    }

    describe(`getAutocompleteItems`, () => {
        describe(`scope`, () => {
            describe(`${Inspection.ScopeItemKind.LetVariable}`, () => {
                it(`match all`, async () =>
                    await assertAutocompleteItems(`let foo = 1, bar = 2, foobar = 3 in |`, [`foo`, `bar`, `foobar`]));

                it(`match some`, async () =>
                    await assertAutocompleteItems(`let foo = 1, bar = 2, foobar = 3 in foo|`, [`foo`, `foobar`]));
            });

            describe(`${Inspection.ScopeItemKind.Parameter}`, () => {
                it(`match all`, async () =>
                    await assertAutocompleteItems(`(foo, bar, foobar) => |`, [`foo`, `bar`, `foobar`]));

                it(`match some`, async () =>
                    await assertAutocompleteItems(`(foo, bar, foobar) => foo|`, [`foo`, `foobar`]));
            });

            describe(`${Inspection.ScopeItemKind.RecordField}`, () => {
                it(`match all`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3, x = |][`, [
                        `foo`,
                        `bar`,
                        `foobar`,
                        `@x`,
                    ]));

                it(`match some`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3, x = foo|`, [`foo`, `foobar`]));
            });

            describe(`${Inspection.ScopeItemKind.SectionMember}`, () => {
                it(`match all`, async () =>
                    await assertAutocompleteItems(`section; foo = 1; bar = 2; foobar = 3; x = |`, [
                        `foo`,
                        `bar`,
                        `foobar`,
                        `@x`,
                    ]));

                it(`match some`, async () =>
                    await assertAutocompleteItems(`section; foo = 1; bar = 2; foobar = 3; x = foo|`, [
                        `foo`,
                        `foobar`,
                    ]));
            });
        });

        describe(`fieldAccess`, () => {
            describe(`fieldProjection`, () => {
                it(`match all`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3][|`, [`foo`, `bar`, `foobar`]));

                it(`match some`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3][[foo|`, [`foo`, `foobar`]));

                it(`no repeats`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3][[foo], [|`, [`bar`, `foobar`]));
            });

            describe(`fieldSelection`, () => {
                it(`match all`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3][|`, [`foo`, `bar`, `foobar`]));

                it(`match some`, async () =>
                    await assertAutocompleteItems(`[foo = 1, bar = 2, foobar = 3][foo|`, [`foo`, `foobar`]));
            });
        });

        xit(`includes textEdit`, async () => {
            const pair: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                `let Test.Foo = 1, Test.FooBar = 2 in Test.Fo|`,
            );

            const document: TextDocument = pair[0];
            const position: Position = pair[1];

            const autocompleteItems: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await AnalysisUtils.createAnalysis(document, {
                    inspectionSettings: TestConstants.SimpleInspectionSettings,
                    isWorkspaceCacheAllowed: false,
                    traceManager: NoOpTraceManagerInstance,
                    initialCorrelationId: undefined,
                }).getAutocompleteItems(position, TestConstants.NoOpCancellationTokenInstance);

            Assert.isOk(autocompleteItems);
            Assert.isDefined(autocompleteItems.value);
            expect(autocompleteItems.value.length).to.equal(2);

            const firstOption: Inspection.AutocompleteItem = TestUtils.assertContainsAutocompleteItem(
                `Test.Foo`,
                autocompleteItems.value,
            );

            const secondOption: Inspection.AutocompleteItem = TestUtils.assertContainsAutocompleteItem(
                `Test.FooBar`,
                autocompleteItems.value,
            );

            Assert.isDefined(firstOption.textEdit, `expected firstOption to have a textEdit`);
            Assert.isDefined(secondOption.textEdit, `expected secondOption to have a textEdit`);
        });
    });

    describe(`getDefinition`, () => {
        async function assertDefinition(textWithPipe: string, expected?: ReadonlyArray<Range>): Promise<void> {
            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                textWithPipe,
            );

            Assert.isOk(actual);

            if (expected !== undefined) {
                TestUtils.assertEqualLocation(expected, Assert.asDefined(actual.value));
            }
        }

        it(`no definition`, async () => await assertDefinition(`let foo = 1 in baz|`));

        it(`let expression`, async () =>
            await assertDefinition(`let foobar = 1 in foobar|`, [
                {
                    end: { character: 10, line: 0 },
                    start: { character: 4, line: 0 },
                },
            ]));

        it(`record expression`, async () =>
            await assertDefinition(`[foo = 1, bar = foo|]`, [
                {
                    end: { character: 4, line: 0 },
                    start: { character: 1, line: 0 },
                },
            ]));

        it(`record expression, not on key`, async () =>
            await assertDefinition(`[foo = 1, bar = [foo| = 2]]`, undefined));

        it(`section expression`, async () =>
            await assertDefinition(`section foo; bar = 1; baz = bar|`, [
                {
                    end: { character: 16, line: 0 },
                    start: { character: 13, line: 0 },
                },
            ]));

        it(`parameter`, async () =>
            await assertDefinition(`(foo as number) => foo|`, [
                {
                    end: { character: 4, line: 0 },
                    start: { character: 1, line: 0 },
                },
            ]));
    });

    describe(`getFoldingRanges`, () => {
        async function assertFoldingRanges(text: string, expected: FoldingRange[]): Promise<void> {
            await TestUtils.assertEqualFoldingRangesAnalysis(
                expected,
                TestConstants.SimpleLibraryAnalysisSettings,
                text,
            );
        }

        it(`LetExpression`, async () =>
            await assertFoldingRanges(`let \n foo = 1 \n in \n baz`, [
                {
                    endCharacter: 4,
                    endLine: 3,
                    startCharacter: 0,
                    startLine: 0,
                },
            ]));

        it(`MetaExpression`, async () =>
            await assertFoldingRanges(`1 meta [ \n foo = number \n ]`, [
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
            ]));

        it(`RecordExpression`, async () =>
            await assertFoldingRanges(`[ \n a=1, \n b=2 \n ]`, [
                {
                    endCharacter: 2,
                    endLine: 3,
                    startCharacter: 0,
                    startLine: 0,
                },
            ]));

        it(`RecordLiteral`, async () =>
            await assertFoldingRanges(`[ \n a=1, \n b=2 \n ] \n section foo; bar = 1`, [
                {
                    endCharacter: 2,
                    endLine: 3,
                    startCharacter: 0,
                    startLine: 0,
                },
            ]));

        it(`SectionMember`, async () =>
            await assertFoldingRanges(`[ \n a=1, \n b=2 \n ] \n section foo; bar = \n let \n foo = 1 \n in \n 1`, [
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
            ]));
    });

    describe(`getHover`, () => {
        async function assertHover(textWithPipe: string, expected: string | undefined): Promise<void> {
            await TestUtils.assertEqualHoverAnalysis(
                expected,
                TestConstants.SimpleLibraryAnalysisSettings,
                textWithPipe,
            );
        }

        describe(`simple`, () => {
            it(`let-variable`, async () => await assertHover(`let x = 1 in x|`, `[let-variable] x: 1`));

            it(`parameter`, async () => await assertHover(`(x as number) => x|`, `[parameter] x: number`));

            it(`record-field`, async () => await assertHover(`[x = 1, y = x|]`, `[record-field] x: 1`));

            it(`section-member`, async () => await assertHover(`section; x = 1; y = x|;`, `[section-member] x: 1`));

            it(`undefined`, async () => await assertHover(`x|`, undefined));

            it(`undefined on parameter hover`, async () =>
                await assertHover(`let foo = 10, bar = (foo| as number) => foo in foo`, undefined));

            describe(`hover the value when over key`, () => {
                it(`let-variable`, async () => await assertHover(`let foo| = 1 in foo`, `[let-variable] foo: 1`));

                it(`record-field expression`, async () => await assertHover(`[foo| = 1]`, `[record-field] foo: 1`));

                it(`record-field literal`, async () =>
                    await assertHover(`[foo| = 1] section; bar = 1;`, `[record-field] foo: 1`));

                it(`section-member`, async () => await assertHover(`section; foo| = 1;`, `[section-member] foo: 1`));
            });
        });

        describe(`getPartialSemanticTokens`, () => {
            async function assertSemanticTokens(
                text: string,
                expected: ReadonlyArray<PartialSemanticToken> | undefined,
            ): Promise<void> {
                await TestUtils.assertEqualPartialSemanticTokensAnalysis(expected, IsolatedAnalysisSettings, text);
            }

            it(`field projection`, async () =>
                await assertSemanticTokens(`a[[b]]?`, [
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
                ]));

            it(`field selector`, async () =>
                await assertSemanticTokens(`a[b]?`, [
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
                ]));

            it(`numeric literal`, async () =>
                await assertSemanticTokens(`1`, [
                    {
                        range: {
                            end: { character: 1, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.number,
                    },
                ]));

            it(`nullable primitive type`, async () =>
                await assertSemanticTokens(`1 is nullable number`, [
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
                ]));

            it(`primitive type`, async () =>
                await assertSemanticTokens(`text`, [
                    {
                        range: {
                            end: { character: 4, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.variable,
                    },
                ]));

            it(`parameter`, async () =>
                await assertSemanticTokens(`(optional foo as number) => foo`, [
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
                ]));

            it(`record literal`, async () =>
                await assertSemanticTokens(`[foo = 1]section bar;`, [
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
                ]));

            it(`record expression`, async () =>
                await assertSemanticTokens(`[foo = 1]`, [
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
                ]));

            it(`table type`, async () =>
                await assertSemanticTokens(`type table [optional foo = nullable number]`, [
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
                ]));

            it(`text literal`, async () =>
                await assertSemanticTokens(`""`, [
                    {
                        range: {
                            end: { character: 2, line: 0 },
                            start: { character: 0, line: 0 },
                        },
                        tokenModifiers: [],
                        tokenType: SemanticTokenTypes.string,
                    },
                ]));

            it(`non-parsable text returns undefined`, async () => await assertSemanticTokens(`"`, undefined));
        });

        describe(`getSignatureHelp`, () => {
            async function assertSignatureHelp(
                textWithPipe: string,
                expected: SignatureHelp | undefined,
            ): Promise<void> {
                await TestUtils.assertSignatureHelpAnalysis(expected, IsolatedAnalysisSettings, textWithPipe);
            }

            it(`no closing bracket`, async () =>
                await assertSignatureHelp(`let fn = (x as number, y as number) => x + y in fn(1|`, {
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
                }));

            it(`closing bracket`, async () =>
                await assertSignatureHelp(`let fn = (x as number, y as number) => x + y in fn(1|)`, {
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
                }));
        });

        describe(`.pq tests`, () => {
            it(`DirectQueryForSQL file`, async () => {
                const postion: Position = {
                    line: 40,
                    character: 25,
                };

                const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                    await TestUtils.createAutocompleteItemsForFile(`DirectQueryForSQL.pq`, postion);

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

                Assert.isOk(actual);
                Assert.isDefined(actual.value);
                TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
            });
        });
    });
});
