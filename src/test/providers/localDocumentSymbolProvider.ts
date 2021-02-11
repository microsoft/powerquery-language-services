// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    AnalysisOptions,
    CompletionItem,
    Hover,
    NullSymbolProvider,
    SignatureHelp,
} from "../../powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { ILibrary } from "../../powerquery-language-services/library/library";
import * as TestConstants from "../testConstants";
import * as TestUtils from "../testUtils";

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
                it(`match all`, async () => {
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
            TestUtils.assertHover("[undefined] x: unknown", hover);
        });
    });

    // describe(`getSignatureHelp`, async () => {
    //     it(`match, no parameter`, async () => {
    //         const actual: SignatureHelp = await createSignatureHelp("Unknown|Identifier");
    //         const expected: TestUtils.AbridgedSignatureHelp = {
    //             // tslint:disable-next-line: no-null-keyword
    //             activeParameter: null,
    //             activeSignature: 0,
    //         };
    //         TestUtils.assertSignatureHelp(expected, actual);
    //     });
    // });
});
