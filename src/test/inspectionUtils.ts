// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { TestConstants, TestUtils } from ".";
import { SymbolKind } from "../powerquery-language-services";

describe(`Document symbol base functions`, () => {
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
                    kind: 13,
                    name: "HelloWorldWithDocs.Contents",
                },
                {
                    kind: 26,
                    name: "HelloWorldType",
                },
                {
                    children: [
                        {
                            kind: 13,
                            name: "_count",
                        },
                        {
                            kind: 13,
                            name: "listOfMessages",
                        },
                        {
                            kind: 13,
                            name: "table",
                        },
                    ],
                    kind: 12,
                    name: "HelloWorldImpl",
                },
                {
                    children: [
                        {
                            kind: 8,
                            name: "Authentication",
                        },
                    ],
                    kind: 23,
                    name: "HelloWorldWithDocs",
                },
                {
                    children: [
                        {
                            kind: 8,
                            name: "Beta",
                        },
                        {
                            kind: 8,
                            name: "Category",
                        },
                        {
                            kind: 8,
                            name: "ButtonText",
                        },
                    ],
                    kind: 23,
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
                                    kind: 8,
                                    name: "Driver",
                                },
                                {
                                    kind: 8,
                                    name: "Server",
                                },
                                {
                                    kind: 8,
                                    name: "Database",
                                },
                            ],
                            kind: 23,
                            name: "ConnectionString",
                        },
                        {
                            kind: 13,
                            name: "Credential",
                        },
                        {
                            kind: 13,
                            name: "CredentialConnectionString",
                        },
                        {
                            kind: 13,
                            name: "OdbcDataSource",
                        },
                        {
                            kind: 13,
                            name: "Database",
                        },
                    ],
                    kind: 12,
                    name: "DirectSQL.Database",
                },
                {
                    children: [
                        {
                            kind: 13,
                            name: "json",
                        },
                        {
                            kind: 13,
                            name: "server",
                        },
                        {
                            kind: 13,
                            name: "database",
                        },
                        {
                            kind: 8,
                            name: "TestConnection",
                        },
                        {
                            kind: 8,
                            name: "Authentication",
                        },
                        {
                            kind: 8,
                            name: "Label",
                        },
                        {
                            kind: 8,
                            name: "SupportsEncryption",
                        },
                    ],
                    kind: 23,
                    name: "DirectSQL",
                },
                {
                    children: [
                        {
                            kind: 8,
                            name: "SupportsDirectQuery",
                        },
                        {
                            kind: 8,
                            name: "Category",
                        },
                        {
                            kind: 8,
                            name: "ButtonText",
                        },
                        {
                            kind: 8,
                            name: "SourceImage",
                        },
                        {
                            kind: 8,
                            name: "SourceTypeImage",
                        },
                    ],
                    kind: 23,
                    name: "DirectSQL.UI",
                },
                {
                    children: [
                        {
                            kind: 8,
                            name: "Icon16",
                        },
                        {
                            kind: 8,
                            name: "Icon32",
                        },
                    ],
                    kind: 23,
                    name: "DirectSQL.Icons",
                },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));
});
