// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { FoldingRange, Location, SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver-types";
import type { Range, TextDocument } from "vscode-languageserver-textdocument";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";

import {
    AnalysisSettings,
    AnalysisUtils,
    EmptyHover,
    Hover,
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
    maybeCreateLanguageAutocompleteItemProviderFn: () => NullSymbolProvider.singleton(),
    maybeCreateLibrarySymbolProviderFn: (_library: Library.ILibrary) => NullSymbolProvider.singleton(),
};

function createAutocompleteItems(text: string): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    return TestUtils.createAutocompleteItems(text, IsolatedAnalysisSettings);
}

function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, IsolatedAnalysisSettings);
}

function createPartialSemanticTokens(text: string): Promise<PartialSemanticToken[]> {
    return TestUtils.createPartialSemanticTokens(text, IsolatedAnalysisSettings);
}

function createSignatureHelp(text: string): Promise<SignatureHelp> {
    return TestUtils.createSignatureHelp(text, IsolatedAnalysisSettings);
}

describe(`SimpleLocalDocumentSymbolProvider`, () => {
    describe(`getAutocompleteItems`, () => {
        describe(`scope`, () => {
            describe(`${Inspection.ScopeItemKind.LetVariable}`, () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "let foo = 1, bar = 2, foobar = 3 in |",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "let foo = 1, bar = 2, foobar = 3 in foo|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });
            });

            describe(`${Inspection.ScopeItemKind.Parameter}`, () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "(foo as number, bar as number, foobar as number) => |",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "(foo as number, bar as number, foobar as number) => foo|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });
            });

            describe(`${Inspection.ScopeItemKind.RecordField}`, () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar", "@x"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3, x = |",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3, x = foo|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });
            });

            describe(`${Inspection.ScopeItemKind.SectionMember}`, () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar", "@x"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "section; foo = 1; bar = 2; foobar = 3; x = |",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "section; foo = 1; bar = 2; foobar = 3; x = foo|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });
            });
        });

        describe(`fieldAccess`, () => {
            describe(`fieldProjection`, () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3][[|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3][[foo|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`no repeats`, async () => {
                    const expected: ReadonlyArray<string> = ["bar", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3][[foo], [|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });
            });

            describe(`fieldSelection`, () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3][|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];

                    const actual: ReadonlyArray<Inspection.AutocompleteItem> = await createAutocompleteItems(
                        "[foo = 1, bar = 2, foobar = 3][foo|",
                    );

                    TestUtils.assertAutocompleteItemLabels(expected, actual);
                });
            });
        });

        xit(`includes textEdit`, async () => {
            const pair: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "let Test.Foo = 1, Test.FooBar = 2 in Test.Fo|",
            );

            const document: TextDocument = pair[0];
            const position: Position = pair[1];

            const autocompleteItems: Inspection.AutocompleteItem[] = await AnalysisUtils.createAnalysis(
                document,
                {
                    createInspectionSettingsFn: () => TestConstants.SimpleInspectionSettings,
                    isWorkspaceCacheAllowed: false,
                    library: TestConstants.SimpleLibrary,
                    traceManager: NoOpTraceManagerInstance,
                    maybeInitialCorrelationId: undefined,
                },
                position,
            ).getAutocompleteItems();

            expect(autocompleteItems.length).to.equal(2);

            const firstOption: Inspection.AutocompleteItem = TestUtils.assertGetAutocompleteItem(
                "Test.Foo",
                autocompleteItems,
            );

            const secondOption: Inspection.AutocompleteItem = TestUtils.assertGetAutocompleteItem(
                "Test.FooBar",
                autocompleteItems,
            );

            Assert.isDefined(firstOption.textEdit, "expected firstOption to have a textEdit");
            Assert.isDefined(secondOption.textEdit, "expected secondOption to have a textEdit");
        });
    });

    describe(`getDefinition`, () => {
        it(`no definition`, async () => {
            const expected: Range[] = [];
            const actual: Location[] | undefined = await TestUtils.createDefinition("let foo = 1 in baz|");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
        });

        it(`let expression`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 10, line: 0 },
                    start: { character: 4, line: 0 },
                },
            ];

            const actual: Location[] | undefined = await TestUtils.createDefinition("let foobar = 1 in foobar|");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
        });

        it(`record expression`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 4, line: 0 },
                    start: { character: 1, line: 0 },
                },
            ];

            const actual: Location[] | undefined = await TestUtils.createDefinition("[foo = 1, bar = foo|]");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
        });

        it(`record expression, not on key`, async () => {
            const expected: Range[] = [];

            const actual: Location[] | undefined = await TestUtils.createDefinition("[foo = 1, bar = [foo| = 2]]");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
        });

        it(`section expression`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 16, line: 0 },
                    start: { character: 13, line: 0 },
                },
            ];

            const actual: Location[] | undefined = await TestUtils.createDefinition("section foo; bar = 1; baz = bar|");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
        });

        it(`parameter`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 4, line: 0 },
                    start: { character: 1, line: 0 },
                },
            ];

            const actual: Location[] | undefined = await TestUtils.createDefinition("(foo as number) => foo|");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
        });
    });

    describe(`getFoldingRanges`, () => {
        it(`LetExpression`, async () => {
            const expected: FoldingRange[] = [
                {
                    endCharacter: 4,
                    endLine: 3,
                    startCharacter: 0,
                    startLine: 0,
                },
            ];

            const actual: FoldingRange[] = await TestUtils.createFoldingRanges("let \n foo = 1 \n in \n baz|");

            Assert.isDefined(actual);
            expect(actual).to.deep.equal(expected);
        });

        it(`MetaExpression`, async () => {
            const expected: FoldingRange[] = [
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
            ];

            const actual: FoldingRange[] = await TestUtils.createFoldingRanges("1 meta [ \n foo = number \n ]|");

            Assert.isDefined(actual);
            expect(actual).to.deep.equal(expected);
        });

        it(`RecordExpression`, async () => {
            const expected: FoldingRange[] = [
                {
                    endCharacter: 2,
                    endLine: 3,
                    startCharacter: 0,
                    startLine: 0,
                },
            ];

            const actual: FoldingRange[] = await TestUtils.createFoldingRanges("[ \n a=1, \n b=2 \n ]|");

            Assert.isDefined(actual);
            expect(actual).to.deep.equal(expected);
        });

        it(`RecordLiteral`, async () => {
            const expected: FoldingRange[] = [
                {
                    endCharacter: 2,
                    endLine: 3,
                    startCharacter: 0,
                    startLine: 0,
                },
            ];

            const actual: FoldingRange[] = await TestUtils.createFoldingRanges(
                "[ \n a=1, \n b=2 \n ] \n section foo; bar = 1|",
            );

            Assert.isDefined(actual);
            expect(actual).to.deep.equal(expected);
        });

        it(`SectionMember`, async () => {
            const expected: FoldingRange[] = [
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
            ];

            const actual: FoldingRange[] = await TestUtils.createFoldingRanges(
                "[ \n a=1, \n b=2 \n ] \n section foo; bar = \n let \n foo = 1 \n in \n 1|",
            );

            Assert.isDefined(actual);
            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`getHover`, () => {
        describe(`simple`, () => {
            it(`let-variable`, async () => {
                const hover: Hover = await createHover("let x = 1 in x|");
                TestUtils.assertEqualHover("[let-variable] x: 1", hover);
            });

            it(`parameter`, async () => {
                const hover: Hover = await createHover("(x as number) => x|");
                TestUtils.assertEqualHover("[parameter] x: number", hover);
            });

            it(`record-field`, async () => {
                const hover: Hover = await createHover("[x = 1, y = x|]");
                TestUtils.assertEqualHover("[record-field] x: 1", hover);
            });

            it(`section-member`, async () => {
                const hover: Hover = await createHover("section; x = 1; y = x|;");
                TestUtils.assertEqualHover("[section-member] x: 1", hover);
            });

            it(`undefined`, async () => {
                const hover: Hover = await createHover("x|");
                expect(hover).to.equal(EmptyHover);
            });
        });

        it(`null on parameter hover`, async () => {
            const hover: Hover = await createHover("let foo = 10, bar = (foo| as number) => foo in foo");
            expect(hover).to.deep.equal(EmptyHover);
        });

        describe(`hover the value when over key`, () => {
            it(`let-variable`, async () => {
                const hover: Hover = await createHover("let foo| = 1 in foo");
                TestUtils.assertEqualHover("[let-variable] foo: 1", hover);
            });

            it(`record-field expression`, async () => {
                const hover: Hover = await createHover("[foo| = 1]");
                TestUtils.assertEqualHover("[record-field] foo: 1", hover);
            });

            it(`record-field literal`, async () => {
                const hover: Hover = await createHover("[foo| = 1] section; bar = 1;");
                TestUtils.assertEqualHover("[record-field] foo: 1", hover);
            });

            it(`section-member`, async () => {
                const hover: Hover = await createHover("section; foo| = 1;");
                TestUtils.assertEqualHover("[section-member] foo: 1", hover);
            });
        });
    });

    describe(`getPartialSemanticTokens`, () => {
        it(`field projection`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`a[[b]]?|`);

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`field selector`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`a[b]?|`);

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`numeric literal`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`1|`);

            const expected: PartialSemanticToken[] = [
                {
                    range: {
                        end: { character: 1, line: 0 },
                        start: { character: 0, line: 0 },
                    },
                    tokenModifiers: [],
                    tokenType: SemanticTokenTypes.number,
                },
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`nullable primitive type`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`1 is nullable number|`);

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`primitive type`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`text|`);

            const expected: PartialSemanticToken[] = [
                {
                    range: {
                        end: { character: 4, line: 0 },
                        start: { character: 0, line: 0 },
                    },
                    tokenModifiers: [],
                    tokenType: SemanticTokenTypes.variable,
                },
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`parameter`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(
                `(optional foo as number) => foo|`,
            );

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`record literal`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`[foo = 1]section bar;|`);

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`record expression`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`[foo = 1]|`);

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`table type`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(
                `type table [optional foo = nullable number]|`,
            );

            const expected: PartialSemanticToken[] = [
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
            ];

            expect(tokens).to.deep.equal(expected);
        });

        it(`text literal`, async () => {
            const tokens: PartialSemanticToken[] = await createPartialSemanticTokens(`""|`);

            const expected: PartialSemanticToken[] = [
                {
                    range: {
                        end: { character: 2, line: 0 },
                        start: { character: 0, line: 0 },
                    },
                    tokenModifiers: [],
                    tokenType: SemanticTokenTypes.string,
                },
            ];

            expect(tokens).to.deep.equal(expected);
        });
    });

    describe(`getSignatureHelp`, () => {
        it(`no closing bracket`, async () => {
            const actual: SignatureHelp = await createSignatureHelp(
                "let fn = (x as number, y as number) => x + y in fn(1|",
            );

            const expected: SignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
                signatures: [
                    {
                        label: "fn(x: number, y: number)",
                        parameters: [
                            {
                                label: "x",
                            },
                            {
                                label: "y",
                            },
                        ],
                    },
                ],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`closing bracket`, async () => {
            const actual: SignatureHelp = await createSignatureHelp(
                "let fn = (x as number, y as number) => x + y in fn(1|)",
            );

            const expected: SignatureHelp = {
                activeParameter: 0,
                activeSignature: 0,
                signatures: [
                    {
                        label: "fn(x: number, y: number)",
                        parameters: [
                            {
                                label: "x",
                            },
                            {
                                label: "y",
                            },
                        ],
                    },
                ],
            };

            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`.pq tests`, () => {
        it("DirectQueryForSQL file", async () => {
            const postion: Position = {
                line: 40,
                character: 25,
            };

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await TestUtils.createAutocompleteItemsForFile(
                "DirectQueryForSQL.pq",
                postion,
            );

            const expected: ReadonlyArray<string> = [
                "ConnectionString",
                "Credential",
                "CredentialConnectionString",
                "Database",
                "DirectSQL",
                "DirectSQL.UI",
                "DirectSQL.Icons",
                "server",
                "database",
            ];

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });
});
