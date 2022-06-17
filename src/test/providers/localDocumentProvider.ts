// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import type { Range, TextDocument } from "vscode-languageserver-textdocument";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import type { Location } from "vscode-languageserver-types";

import {
    AnalysisSettings,
    AnalysisUtils,
    EmptyHover,
    Hover,
    Inspection,
    Library,
    NullSymbolProvider,
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
        it(`let foobar = 1 in foobar|`, async () => {
            const expected: Range[] = [
                {
                    end: {
                        character: 10,
                        line: 0,
                    },
                    start: {
                        character: 4,
                        line: 0,
                    },
                },
            ];

            const actual: Location[] | undefined = await TestUtils.createDefinition("let foobar = 1 in foobar|");
            Assert.isDefined(actual);
            TestUtils.assertEqualLocation(expected, actual);
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
