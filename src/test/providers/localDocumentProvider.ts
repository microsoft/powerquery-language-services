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
    languageAutocompleteItemProviderFactory: () => NullSymbolProvider.singleton(),
    libraryProviderFactory: (_library: Library.ILibrary) => NullSymbolProvider.singleton(),
};

function createAutocompleteItems(
    text: string,
): Promise<Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError>> {
    return TestUtils.createAutocompleteItems(text, IsolatedAnalysisSettings);
}

function createHover(text: string): Promise<Result<Hover | undefined, CommonError.CommonError>> {
    return TestUtils.createHover(text, IsolatedAnalysisSettings);
}

function createPartialSemanticTokens(
    text: string,
): Promise<Result<PartialSemanticToken[] | undefined, CommonError.CommonError>> {
    return TestUtils.createPartialSemanticTokens(text, IsolatedAnalysisSettings);
}

function createSignatureHelp(text: string): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
    return TestUtils.createSignatureHelp(text, IsolatedAnalysisSettings);
}

describe(`SimpleLocalDocumentSymbolProvider`, () => {
    describe(`getAutocompleteItems`, () => {
        describe(`scope`, () => {
            describe(`${Inspection.ScopeItemKind.LetVariable}`, () => {
                it(`match all`, async () => {
                    const expected: string[] = ["foo", "bar", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("let foo = 1, bar = 2, foobar = 3 in |");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`match some`, async () => {
                    const expected: string[] = ["foo", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("let foo = 1, bar = 2, foobar = 3 in foo|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });
            });

            describe(`${Inspection.ScopeItemKind.Parameter}`, () => {
                it(`match all`, async () => {
                    const expected: string[] = ["foo", "bar", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("(foo as number, bar as number, foobar as number) => |");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`match some`, async () => {
                    const expected: string[] = ["foo", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("(foo as number, bar as number, foobar as number) => foo|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });
            });

            describe(`${Inspection.ScopeItemKind.RecordField}`, () => {
                it(`match all`, async () => {
                    const expected: string[] = ["foo", "bar", "foobar", "@x"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3, x = |");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`match some`, async () => {
                    const expected: string[] = ["foo", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3, x = foo|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });
            });

            describe(`${Inspection.ScopeItemKind.SectionMember}`, () => {
                it(`match all`, async () => {
                    const expected: string[] = ["foo", "bar", "foobar", "@x"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("section; foo = 1; bar = 2; foobar = 3; x = |");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`match some`, async () => {
                    const expected: string[] = ["foo", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("section; foo = 1; bar = 2; foobar = 3; x = foo|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });
            });
        });

        describe(`fieldAccess`, () => {
            describe(`fieldProjection`, () => {
                it(`match all`, async () => {
                    const expected: string[] = ["foo", "bar", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3][[|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`match some`, async () => {
                    const expected: string[] = ["foo", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3][[foo|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`no repeats`, async () => {
                    const expected: string[] = ["bar", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3][[foo], [|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });
            });

            describe(`fieldSelection`, () => {
                it(`match all`, async () => {
                    const expected: string[] = ["foo", "bar", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3][|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });

                it(`match some`, async () => {
                    const expected: string[] = ["foo", "foobar"];

                    const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                        await createAutocompleteItems("[foo = 1, bar = 2, foobar = 3][foo|");

                    Assert.isOk(actual);
                    Assert.isDefined(actual.value);
                    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
                });
            });
        });

        xit(`includes textEdit`, async () => {
            const pair: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "let Test.Foo = 1, Test.FooBar = 2 in Test.Fo|",
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

            const firstOption: Inspection.AutocompleteItem = TestUtils.assertGetAutocompleteItem(
                "Test.Foo",
                autocompleteItems.value,
            );

            const secondOption: Inspection.AutocompleteItem = TestUtils.assertGetAutocompleteItem(
                "Test.FooBar",
                autocompleteItems.value,
            );

            Assert.isDefined(firstOption.textEdit, "expected firstOption to have a textEdit");
            Assert.isDefined(secondOption.textEdit, "expected secondOption to have a textEdit");
        });
    });

    describe(`getDefinition`, () => {
        it(`no definition`, async () => {
            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                "let foo = 1 in baz|",
            );

            Assert.isOk(actual);
            Assert.isUndefined(actual.value);
        });

        it(`let expression`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 10, line: 0 },
                    start: { character: 4, line: 0 },
                },
            ];

            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                "let foobar = 1 in foobar|",
            );

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertEqualLocation(expected, actual.value);
        });

        it(`record expression`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 4, line: 0 },
                    start: { character: 1, line: 0 },
                },
            ];

            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                "[foo = 1, bar = foo|]",
            );

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertEqualLocation(expected, actual.value);
        });

        it(`record expression, not on key`, async () => {
            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                "[foo = 1, bar = [foo| = 2]]",
            );

            Assert.isOk(actual);
            Assert.isUndefined(actual.value);
        });

        it(`section expression`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 16, line: 0 },
                    start: { character: 13, line: 0 },
                },
            ];

            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                "section foo; bar = 1; baz = bar|",
            );

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertEqualLocation(expected, actual.value);
        });

        it(`parameter`, async () => {
            const expected: Range[] = [
                {
                    end: { character: 4, line: 0 },
                    start: { character: 1, line: 0 },
                },
            ];

            const actual: Result<Location[] | undefined, CommonError.CommonError> = await TestUtils.createDefinition(
                "(foo as number) => foo|",
            );

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertEqualLocation(expected, actual.value);
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

            const actual: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await TestUtils.createFoldingRanges("let \n foo = 1 \n in \n baz");

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
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

            const actual: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await TestUtils.createFoldingRanges("1 meta [ \n foo = number \n ]");

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
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

            const actual: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await TestUtils.createFoldingRanges("[ \n a=1, \n b=2 \n ]");

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
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

            const actual: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await TestUtils.createFoldingRanges("[ \n a=1, \n b=2 \n ] \n section foo; bar = 1");

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
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

            const actual: Result<FoldingRange[] | undefined, CommonError.CommonError> =
                await TestUtils.createFoldingRanges(
                    "[ \n a=1, \n b=2 \n ] \n section foo; bar = \n let \n foo = 1 \n in \n 1",
                );

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });
    });

    describe(`getHover`, () => {
        describe(`simple`, () => {
            it(`let-variable`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("let x = 1 in x|");
                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[let-variable] x: 1", hover.value);
            });

            it(`parameter`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
                    "(x as number) => x|",
                );

                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[parameter] x: number", hover.value);
            });

            it(`record-field`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("[x = 1, y = x|]");
                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[record-field] x: 1", hover.value);
            });

            it(`section-member`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
                    "section; x = 1; y = x|;",
                );

                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[section-member] x: 1", hover.value);
            });

            it(`undefined`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("x|");
                Assert.isOk(hover);
                Assert.isUndefined(hover.value);
            });
        });

        it(`undefined on parameter hover`, async () => {
            const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
                "let foo = 10, bar = (foo| as number) => foo in foo",
            );

            Assert.isOk(hover);
            Assert.isUndefined(hover.value);
        });

        describe(`hover the value when over key`, () => {
            it(`let-variable`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
                    "let foo| = 1 in foo",
                );

                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[let-variable] foo: 1", hover.value);
            });

            it(`record-field expression`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover("[foo| = 1]");
                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[record-field] foo: 1", hover.value);
            });

            it(`record-field literal`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
                    "[foo| = 1] section; bar = 1;",
                );

                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[record-field] foo: 1", hover.value);
            });

            it(`section-member`, async () => {
                const hover: Result<Hover | undefined, CommonError.CommonError> = await createHover(
                    "section; foo| = 1;",
                );

                Assert.isOk(hover);
                Assert.isDefined(hover.value);
                TestUtils.assertEqualHover("[section-member] foo: 1", hover.value);
            });
        });
    });

    describe(`getPartialSemanticTokens`, () => {
        it(`field projection`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`a[[b]]?`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`field selector`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`a[b]?`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`numeric literal`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`1`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`nullable primitive type`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`1 is nullable number`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`primitive type`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`text`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`parameter`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`(optional foo as number) => foo`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`record literal`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`[foo = 1]section bar;`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`record expression`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`[foo = 1]`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`table type`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`type table [optional foo = nullable number]`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`text literal`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`""`);

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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`non-parsable text returns undefined`, async () => {
            const actual: Result<PartialSemanticToken[] | undefined, CommonError.CommonError> =
                await createPartialSemanticTokens(`"`);

            Assert.isOk(actual);
            expect(actual.value).to.equal(undefined);
        });
    });

    describe(`getSignatureHelp`, () => {
        it(`no closing bracket`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> = await createSignatureHelp(
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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });

        it(`closing bracket`, async () => {
            const actual: Result<SignatureHelp | undefined, CommonError.CommonError> = await createSignatureHelp(
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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            expect(actual.value).to.deep.equal(expected);
        });
    });

    describe(`.pq tests`, () => {
        it("DirectQueryForSQL file", async () => {
            const postion: Position = {
                line: 40,
                character: 25,
            };

            const actual: Result<Inspection.AutocompleteItem[] | undefined, CommonError.CommonError> =
                await TestUtils.createAutocompleteItemsForFile("DirectQueryForSQL.pq", postion);

            const expected: string[] = [
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

            Assert.isOk(actual);
            Assert.isDefined(actual.value);
            TestUtils.assertContainsAutocompleteItemLabels(expected, actual.value);
        });
    });
});
