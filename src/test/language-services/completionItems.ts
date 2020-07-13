// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as PQP from "@microsoft/powerquery-parser";
import "mocha";
import { CompletionItem, Position } from "../../language-services";

import * as Utils from "./utils";

const LibraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider(["Text.NewGuid"]);
const ExpressionKeywordWhitelist: string[] = [
    PQP.Language.KeywordKind.Each,
    PQP.Language.KeywordKind.Error,
    PQP.Language.KeywordKind.False,
    PQP.Language.KeywordKind.If,
    PQP.Language.KeywordKind.Let,
    PQP.Language.KeywordKind.Not,
    PQP.Language.KeywordKind.True,
    PQP.Language.KeywordKind.Try,
    PQP.Language.KeywordKind.Type,
];

const AllPrimitiveTypes: string[] = [
    PQP.Language.Ast.PrimitiveTypeConstantKind.Action,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Any,
    PQP.Language.Ast.PrimitiveTypeConstantKind.AnyNonNull,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Binary,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Date,
    PQP.Language.Ast.PrimitiveTypeConstantKind.DateTime,
    PQP.Language.Ast.PrimitiveTypeConstantKind.DateTimeZone,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Duration,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Function,
    PQP.Language.Ast.PrimitiveTypeConstantKind.List,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Logical,
    PQP.Language.Ast.PrimitiveTypeConstantKind.None,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Null,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Number,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Record,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Table,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Text,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Time,
    PQP.Language.Ast.PrimitiveTypeConstantKind.Type,
];

describe("Completion Items (null provider)", () => {
    it("blank document keywords", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|");

        // TODO: uncomment when we have fully context sensitive language constants
        // expect(result.length).to.equal(10);
        // result.forEach(item => {
        //     expect(item.kind).to.equal(CompletionItemKind.Keyword);
        // });

        // TODO: use equals instead of contains when we have fully context sensitive language constants
        // Utils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, PQP.Language.KeywordKind.Section]);
        Utils.containsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, PQP.Language.KeywordKind.Section]);
    });

    it("simple document", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("let a = 1, b = 2, c = 3 in |c");
        // TODO: use equals instead of contains when we have context sensitive language constants
        // Utils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "a", "b", "c"]);
        Utils.containsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "a", "b", "c"]);
    });
});

describe("Completion Items (Simple provider)", () => {
    it("keywords still work with library provider", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            librarySymbolProvider: LibraryProvider,
        });

        Utils.containsCompletionItemLabels(result, [
            ...ExpressionKeywordWhitelist,
            PQP.Language.KeywordKind.Section,
            "Text.NewGuid",
        ]);
    });

    it("keywords still work with environment provider", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            environmentSymbolProvider: LibraryProvider,
        });

        Utils.containsCompletionItemLabels(result, [
            ...ExpressionKeywordWhitelist,
            PQP.Language.KeywordKind.Section,
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
            PQP.Language.KeywordKind.Section,
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

describe("Other language constants", () => {
    it("(a as |", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems(`(a as |`);

        Utils.containsCompletionItemLabels(result, [
            ...AllPrimitiveTypes,
            PQP.Language.Ast.IdentifierConstantKind.Nullable,
        ]);
    });

    it("let a = 1 is |", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems(`let a = 1 is |`);

        Utils.containsCompletionItemLabels(result, [
            ...AllPrimitiveTypes,
            PQP.Language.Ast.IdentifierConstantKind.Nullable,
        ]);
    });

    it("(a, |", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems(`(a, |`);

        Utils.containsCompletionItemLabels(result, [PQP.Language.Ast.IdentifierConstantKind.Optional]);
    });

    it("(a, op|", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems(`(a, op|`);

        Utils.containsCompletionItemLabels(result, [PQP.Language.Ast.IdentifierConstantKind.Optional]);
    });
});
