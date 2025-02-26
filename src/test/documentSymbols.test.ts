// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { NoOpCancellationToken } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from ".";
import { AbridgedDocumentSymbol } from "./testUtils";
import { SymbolKind } from "../powerquery-language-services";

describe("getDocumentSymbols", () => {
    async function assertSymbolsForDocument(
        text: string,
        expectedSymbols: ReadonlyArray<AbridgedDocumentSymbol>,
    ): Promise<void> {
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            text,
            expectedSymbols,
            TestConstants.SimpleLibraryAnalysisSettings,
            NoOpCancellationToken,
        );
    }

    it(`section foo; shared a = 1;`, async () => {
        await assertSymbolsForDocument(`section foo; shared a = 1;`, [{ name: "a", kind: SymbolKind.Number }]);
    });

    it(`section foo; shared query = let a = 1 in a;`, async () => {
        await assertSymbolsForDocument(`section foo; shared query = let a = 1 in a;`, [
            { name: "query", kind: SymbolKind.Variable, children: [{ name: "a", kind: SymbolKind.Number }] },
        ]);
    });

    it(`let a = 1, b = "hello", c = () => 1 in c`, async () => {
        await assertSymbolsForDocument(`let a = 1, b = "hello", c = () => 1 in c`, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Function },
        ]);
    });

    it(`let a = let b = 1, c = let d = 1 in d in c in a`, async () => {
        await assertSymbolsForDocument(`let a = let b = 1, c = let d = 1 in d in c in a`, [
            {
                name: "a",
                kind: SymbolKind.Variable,
                children: [
                    { name: "b", kind: SymbolKind.Number },
                    { name: "c", kind: SymbolKind.Variable, children: [{ name: "d", kind: SymbolKind.Number }] },
                ],
            },
        ]);
    });

    // with syntax error
    it(`section foo; shared a = 1; b = "hello"; c = let a1`, async () => {
        await assertSymbolsForDocument(`section foo; shared a = 1; b = "hello"; c = let a1`, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
        ]);
    });

    it(`HelloWorldWithDocs.pq`, async () => {
        await assertSymbolsForDocument(TestUtils.readFile(`HelloWorldWithDocs.pq`), [
            // HelloWorldWithDocs.Contents comes back as a Variable because of the use of Value.ReplaceType
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            {
                name: "HelloWorldImpl",
                kind: SymbolKind.Function,
                children: [
                    { name: "_count", kind: SymbolKind.Variable },
                    { name: "listOfMessages", kind: SymbolKind.Variable },
                    { name: "table", kind: SymbolKind.Variable },
                ],
            },
            {
                name: "HelloWorldWithDocs",
                kind: SymbolKind.Struct,
                children: [{ name: "Authentication", kind: SymbolKind.Field }],
            },
            {
                name: "HelloWorldWithDocs.Publish",
                kind: SymbolKind.Struct,
                children: [
                    { name: "Beta", kind: SymbolKind.Field },
                    { name: "Category", kind: SymbolKind.Field },
                    { name: "ButtonText", kind: SymbolKind.Field },
                ],
            },
        ]);
    });

    it(`section foo; shared a = 1; b = "abc"; c = true;`, async () =>
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            `section foo; shared a = 1; b = "abc"; c = true;`,
            [
                { name: `a`, kind: SymbolKind.Number },
                { name: `b`, kind: SymbolKind.String },
                { name: `c`, kind: SymbolKind.Boolean },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));

    it(`section foo; a = {1,2};`, async () =>
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            `section foo; a = {1,2};`,
            [{ name: `a`, kind: SymbolKind.Array }],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));

    it(`let a = 1, b = 2, c = 3 in c`, async () =>
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            `let a = 1, b = 2, c = 3 in c`,
            [
                { name: `a`, kind: SymbolKind.Number },
                { name: `b`, kind: SymbolKind.Number },
                { name: `c`, kind: SymbolKind.Number },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));

    it("HelloWorldWithDocs file section", async () =>
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            TestUtils.readFile(`HelloWorldWithDocs.pq`),
            [
                {
                    kind: SymbolKind.Variable,
                    name: "HelloWorldWithDocs.Contents",
                },
                {
                    kind: SymbolKind.TypeParameter,
                    name: "HelloWorldType",
                },
                {
                    children: [
                        {
                            kind: SymbolKind.Variable,
                            name: "_count",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "listOfMessages",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "table",
                        },
                    ],
                    kind: SymbolKind.Function,
                    name: "HelloWorldImpl",
                },
                {
                    children: [
                        {
                            kind: SymbolKind.Field,
                            name: "Authentication",
                        },
                    ],
                    kind: SymbolKind.Struct,
                    name: "HelloWorldWithDocs",
                },
                {
                    children: [
                        {
                            kind: SymbolKind.Field,
                            name: "Beta",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "Category",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "ButtonText",
                        },
                    ],
                    kind: SymbolKind.Struct,
                    name: "HelloWorldWithDocs.Publish",
                },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));

    it("DirectQueryForSQL file section", async () =>
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            TestUtils.readFile(`DirectQueryForSQL.pq`),
            [
                {
                    children: [
                        {
                            children: [
                                {
                                    kind: SymbolKind.Field,
                                    name: "Driver",
                                },
                                {
                                    kind: SymbolKind.Field,
                                    name: "Server",
                                },
                                {
                                    kind: SymbolKind.Field,
                                    name: "Database",
                                },
                            ],
                            kind: SymbolKind.Struct,
                            name: "ConnectionString",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "Credential",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "CredentialConnectionString",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "OdbcDataSource",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "Database",
                        },
                    ],
                    kind: SymbolKind.Function,
                    name: "DirectSQL.Database",
                },
                {
                    children: [
                        {
                            kind: SymbolKind.Variable,
                            name: "json",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "server",
                        },
                        {
                            kind: SymbolKind.Variable,
                            name: "database",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "TestConnection",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "Authentication",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "Label",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "SupportsEncryption",
                        },
                    ],
                    kind: SymbolKind.Struct,
                    name: "DirectSQL",
                },
                {
                    children: [
                        {
                            kind: SymbolKind.Field,
                            name: "SupportsDirectQuery",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "Category",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "ButtonText",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "SourceImage",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "SourceTypeImage",
                        },
                    ],
                    kind: SymbolKind.Struct,
                    name: "DirectSQL.UI",
                },
                {
                    children: [
                        {
                            kind: SymbolKind.Field,
                            name: "Icon16",
                        },
                        {
                            kind: SymbolKind.Field,
                            name: "Icon32",
                        },
                    ],
                    kind: SymbolKind.Struct,
                    name: "DirectSQL.Icons",
                },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));
});
