// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";
import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver-types";

import * as Utils from "./utils";

const LibraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider(["Text.NewGuid"]);
const ExpressionKeywordWhitelist: string[] = [
    PQP.KeywordKind.Each,
    PQP.KeywordKind.Error,
    PQP.KeywordKind.False,
    PQP.KeywordKind.If,
    PQP.KeywordKind.Let,
    PQP.KeywordKind.Not,
    PQP.KeywordKind.True,
    PQP.KeywordKind.Try,
    PQP.KeywordKind.Type,
];

describe("Completion Items (null provider)", () => {
    it("blank document keywords", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|");

        expect(result.length).to.equal(10);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, PQP.KeywordKind.Section]);
    });

    it("simple document", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("let a = 1, b = 2, c = 3 in |c");
        Utils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "a", "b", "c"]);
    });
});

describe("Completion Items (Simple provider)", () => {
    it("keywords still work with library provider", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            librarySymbolProvider: LibraryProvider,
        });

        Utils.containsCompletionItemLabels(result, [
            ...ExpressionKeywordWhitelist,
            PQP.KeywordKind.Section,
            "Text.NewGuid",
        ]);
    });

    it("keywords still work with environment provider", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            environmentSymbolProvider: LibraryProvider,
        });

        Utils.containsCompletionItemLabels(result, [
            ...ExpressionKeywordWhitelist,
            PQP.KeywordKind.Section,
            "Text.NewGuid",
        ]);
    });

    it("keywords still work with library and environment", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            librarySymbolProvider: LibraryProvider,
            environmentSymbolProvider: LibraryProvider,
        });

        Utils.containsCompletionItemLabels(result, [
            ...ExpressionKeywordWhitelist,
            PQP.KeywordKind.Section,
            "Text.NewGuid",
        ]);
    });
});

describe("Completion Items (Current Document Provider)", () => {
    it("DirectQueryForSQL file", async () => {
        const postion: Position = {
            line: 40,
            character: 25,
        };
        const result: CompletionItem[] = await Utils.getCompletionItemsForFile("DirectQueryForSQL.pq", postion);

        Utils.containsCompletionItemLabels(result, [
            "ConnectionString",
            "Credential",
            "CredentialConnectionString",
            "Database",
            "DirectSQL",
            "DirectSQL.UI",
            "DirectSQL.Icons",
            "server",
            "database",
        ]);
    });

    it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems(
            `section foo; a = () => true; b = "string"; c = 1; d = |;`,
        );

        Utils.containsCompletionItemLabels(result, ["a", "b", "c", "let"]);
    });
});
