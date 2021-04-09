// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from "..";
import {
    AnalysisOptions,
    AnalysisUtils,
    EmptyHover,
    Hover,
    Inspection,
    NullSymbolProvider,
    Position,
    SignatureHelp,
    TextDocument,
} from "../../powerquery-language-services";
import { ILibrary } from "../../powerquery-language-services/library/library";
import { MockDocument } from "../mockDocument";
import { SimpleLibrary } from "../testConstants";

const IsolatedAnalysisOptions: AnalysisOptions = {
    ...TestConstants.SimpleLibraryAnalysisOptions,
    createLanguageAutocompleteItemProviderFn: () => NullSymbolProvider.singleton(),
    createLibrarySymbolProviderFn: (_library: ILibrary) => NullSymbolProvider.singleton(),
};

async function createAutocompleteItems(text: string): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    return TestUtils.createAutocompleteItems(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

async function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

async function createSignatureHelp(text: string): Promise<SignatureHelp> {
    return TestUtils.createSignatureHelp(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

describe(`SimpleLocalDocumentSymbolProvider`, async () => {
    describe(`getAutocompleteItems`, async () => {
        describe(`scope`, async () => {
            describe(`${Inspection.ScopeItemKind.LetVariable}`, async () => {
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

            describe(`${Inspection.ScopeItemKind.Parameter}`, async () => {
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

            describe(`${Inspection.ScopeItemKind.RecordField}`, async () => {
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

            describe(`${Inspection.ScopeItemKind.SectionMember}`, async () => {
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

        describe(`fieldAccess`, async () => {
            describe(`fieldProjection`, async () => {
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

            describe(`fieldSelection`, async () => {
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

        it(`WIP includes textEdit`, async () => {
            const pair: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "let Test.Foo = 1, Test.FooBar = 2 in Test.Fo|",
            );
            const document: TextDocument = pair[0];
            const position: Position = pair[1];

            const autocompleteItems: Inspection.AutocompleteItem[] = await AnalysisUtils.createAnalysis(
                document,
                position,
                SimpleLibrary,
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

    describe(`getHover`, async () => {
        it(`let-variable`, async () => {
            const hover: Hover = await createHover("let x = 1 in x|");
            TestUtils.assertHover("[let-variable] x: 1", hover);
        });

        it(`parameter`, async () => {
            const hover: Hover = await createHover("(x as number) => x|");
            TestUtils.assertHover("[parameter] x: number", hover);
        });

        it(`record-field`, async () => {
            const hover: Hover = await createHover("[x = 1, y = x|]");
            TestUtils.assertHover("[record-field] x: 1", hover);
        });

        it(`section-member`, async () => {
            const hover: Hover = await createHover("section; x = 1; y = x|;");
            TestUtils.assertHover("[section-member] x: 1", hover);
        });

        it(`undefined`, async () => {
            const hover: Hover = await createHover("x|");
            expect(hover).to.equal(EmptyHover);
        });
    });

    describe(`getSignatureHelp`, async () => {
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

    describe(`.pq tests`, async () => {
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
