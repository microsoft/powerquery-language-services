// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";

import { TestConstants, TestUtils } from "..";
import {
    AnalysisOptions,
    AnalysisUtils,
    CompletionItem,
    EmptyHover,
    Hover,
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
    createLanguageCompletionItemProviderFn: () => NullSymbolProvider.singleton(),
    createLibrarySymbolProviderFn: (_library: ILibrary) => NullSymbolProvider.singleton(),
};

async function createCompletionItems(text: string): Promise<ReadonlyArray<CompletionItem>> {
    return TestUtils.createCompletionItems(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

async function createHover(text: string): Promise<Hover> {
    return TestUtils.createHover(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

async function createSignatureHelp(text: string): Promise<SignatureHelp> {
    return TestUtils.createSignatureHelp(text, TestConstants.SimpleLibrary, IsolatedAnalysisOptions);
}

describe(`SimpleLocalDocumentSymbolProvider`, async () => {
    describe(`getCompletionItems`, async () => {
        describe(`scope`, async () => {
            describe(`${PQP.Inspection.ScopeItemKind.LetVariable}`, async () => {
                it(`WIP match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "let foo = 1, bar = 2, foobar = 3 in |",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "let foo = 1, bar = 2, foobar = 3 in foo|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });
            });

            describe(`${PQP.Inspection.ScopeItemKind.Parameter}`, async () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "(foo as number, bar as number, foobar as number) => |",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "(foo as number, bar as number, foobar as number) => foo|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });
            });

            describe(`${PQP.Inspection.ScopeItemKind.RecordField}`, async () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar", "@x"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3, x = |",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3, x = foo|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });
            });

            describe(`${PQP.Inspection.ScopeItemKind.SectionMember}`, async () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar", "@x"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "section; foo = 1; bar = 2; foobar = 3; x = |",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "section; foo = 1; bar = 2; foobar = 3; x = foo|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });
            });
        });

        describe(`fieldAccess`, async () => {
            describe(`fieldProjection`, async () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3][[|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3][[foo|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`no repeats`, async () => {
                    const expected: ReadonlyArray<string> = ["bar", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3][[foo], [|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });
            });

            describe(`fieldSelection`, async () => {
                it(`match all`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "bar", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3][|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });

                it(`match some`, async () => {
                    const expected: ReadonlyArray<string> = ["foo", "foobar"];
                    const actual: ReadonlyArray<CompletionItem> = await createCompletionItems(
                        "[foo = 1, bar = 2, foobar = 3][foo|",
                    );
                    TestUtils.assertCompletionItemLabels(expected, actual);
                });
            });
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
        it(`signature`, async () => {
            const actual: SignatureHelp = await createSignatureHelp(
                "let fn = (x as number, y as number) => x + y in fn(1|",
            );
            const expected: SignatureHelp = {
                // tslint:disable-next-line: no-null-keyword
                activeParameter: 0,
                activeSignature: 0,
                signatures: [
                    {
                        label: "fn",
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
            const actual: ReadonlyArray<CompletionItem> = await TestUtils.createCompletionItemsForFile(
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

            TestUtils.assertCompletionItemLabels(expected, actual);
        });
    });

    describe(`Completionitem`, async () => {
        it(`TODO`, async () => {
            const pair: [MockDocument, Position] = TestUtils.createMockDocumentAndPosition(
                "let Test.Foo = 1, Test.FooBar = 2 in Test.Fo|",
            );
            const document: TextDocument = pair[0];
            const position: Position = pair[1];

            const completionItems: CompletionItem[] = await AnalysisUtils.createAnalysis(
                document,
                position,
                SimpleLibrary,
            ).getCompletionItems();
            expect(completionItems.length).to.equal(2);

            const firstOption: CompletionItem = TestUtils.assertGetCompletionItem("Test.Foo", completionItems);
            const secondOption: CompletionItem = TestUtils.assertGetCompletionItem("Test.FooBar", completionItems);

            Assert.isDefined(firstOption.textEdit, "expected firstOption to have a textEdit");
            Assert.isDefined(secondOption.textEdit, "expected secondOption to have a textEdit");
        });
    });
});
