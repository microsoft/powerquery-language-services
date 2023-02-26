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
                { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
                { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
                { name: "HelloWorldImpl", kind: SymbolKind.Function },
                { name: "HelloWorldWithDocs", kind: SymbolKind.Struct },
                { name: "HelloWorldWithDocs.Publish", kind: SymbolKind.Struct },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));

    it("DirectQueryForSQL file section", async () =>
        await TestUtils.assertEqualDocumentSymbolsAnalysis(
            TestUtils.readFile(`DirectQueryForSQL.pq`),
            [
                { name: "DirectSQL.Database", kind: SymbolKind.Function },
                { name: "DirectSQL", kind: SymbolKind.Struct },
                { name: "DirectSQL.UI", kind: SymbolKind.Struct },
                { name: "DirectSQL.Icons", kind: SymbolKind.Struct },
            ],
            TestConstants.SimpleLibraryAnalysisSettings,
        ));
});
