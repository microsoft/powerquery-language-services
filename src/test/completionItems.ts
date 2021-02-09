// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT license.

// // tslint:disable: no-implicit-dependencies
// import * as PQP from "@microsoft/powerquery-parser";
// import { expect } from "chai";
// import "mocha";
// import { CompletionItem, CompletionItemKind, Position } from "../powerquery-language-services";

// import * as TestUtils from "./testUtils";

// const LibraryProvider: TestUtils.SimpleLibraryProvider = new TestUtils.SimpleLibraryProvider(["Text.NewGuid"]);

// const ExpressionKeywordWhitelist: ReadonlyArray<string> = [
//     PQP.Language.Keyword.KeywordKind.Each,
//     PQP.Language.Keyword.KeywordKind.Error,
//     PQP.Language.Keyword.KeywordKind.False,
//     PQP.Language.Keyword.KeywordKind.If,
//     PQP.Language.Keyword.KeywordKind.Let,
//     PQP.Language.Keyword.KeywordKind.Not,
//     PQP.Language.Keyword.KeywordKind.True,
//     PQP.Language.Keyword.KeywordKind.Try,
//     PQP.Language.Keyword.KeywordKind.Type,
// ];

// const AllPrimitiveTypes: ReadonlyArray<string> = [
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Action,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Any,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.AnyNonNull,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Binary,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Date,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.DateTime,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.DateTimeZone,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Duration,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Function,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.List,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Logical,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.None,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Null,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Number,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Record,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Table,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Text,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Time,
//     PQP.Language.Constant.PrimitiveTypeConstantKind.Type,
// ];

// describe("Completion Items (null provider)", () => {
//     it("blank document keywords", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems("|");

//         expect(result.length).to.equal(10);
//         result.forEach(item => {
//             expect(item.kind).to.equal(CompletionItemKind.Keyword);
//         });

//         TestUtils.equalsCompletionItemLabels(result, [
//             ...ExpressionKeywordWhitelist,
//             PQP.Language.Keyword.KeywordKind.Section,
//         ]);
//     });

//     it("after in", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(
//             "let a = 1, b = 2, c = 3 in |c",
//         );
//         TestUtils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "a", "b", "c"]);
//     });

//     it("section after equals", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems("section pq; a = |");
//         TestUtils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "@a"]);
//     });

//     it("expression after equals", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems("let a = |");
//         TestUtils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "@a"]);
//     });
// });

// describe("Completion Items (Simple provider)", () => {
//     it("keywords still work with library provider", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems("|", {
//             libraryProvider: LibraryProvider,
//         });

//         TestUtils.equalsCompletionItemLabels(result, [
//             ...ExpressionKeywordWhitelist,
//             PQP.Language.Keyword.KeywordKind.Section,
//             "Text.NewGuid",
//         ]);
//     });

//     it("keywords still work with environment provider", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems("|", {
//             environmentSymbolProvider: LibraryProvider,
//         });

//         TestUtils.equalsCompletionItemLabels(result, [
//             ...ExpressionKeywordWhitelist,
//             PQP.Language.Keyword.KeywordKind.Section,
//             "Text.NewGuid",
//         ]);
//     });

//     it("keywords still work with library and environment", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems("|", {
//             libraryProvider: LibraryProvider,
//             environmentSymbolProvider: LibraryProvider,
//         });

//         // TODO: completion item provider doesn't filter out duplicates
//         TestUtils.equalsCompletionItemLabels(result, [
//             ...ExpressionKeywordWhitelist,
//             PQP.Language.Keyword.KeywordKind.Section,
//             "Text.NewGuid",
//             "Text.NewGuid",
//         ]);
//     });
// });

// describe("Completion Items (Current Document Provider)", () => {
//     it("DirectQueryForSQL file", async () => {
//         const postion: Position = {
//             line: 40,
//             character: 25,
//         };
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItemsForFile(
//             "DirectQueryForSQL.pq",
//             postion,
//         );

//         TestUtils.containsCompletionItemLabels(result, [
//             "ConnectionString",
//             "Credential",
//             "CredentialConnectionString",
//             "Database",
//             "DirectSQL",
//             "DirectSQL.UI",
//             "DirectSQL.Icons",
//             "server",
//             "database",
//         ]);
//     });

//     it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(
//             `section foo; a = () => true; b = "string"; c = 1; d = |;`,
//         );

//         TestUtils.containsCompletionItemLabels(result, ["a", "b", "c", "let"]);
//     });

//     it("field access", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(
//             "let fn = () => [cat = 1, car = 2] in fn()[|",
//         );
//         TestUtils.equalsCompletionItemLabels(result, [...ExpressionKeywordWhitelist, "fn", "cat", "car"]);
//     });
// });

// describe("Other language constants", () => {
//     it("(a as |", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(`(a as |`);

//         TestUtils.containsCompletionItemLabels(result, [
//             ...AllPrimitiveTypes,
//             PQP.Language.Constant.LanguageConstantKind.Nullable,
//         ]);
//     });

//     it("let a = 1 is |", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(`let a = 1 is |`);

//         TestUtils.containsCompletionItemLabels(result, [
//             ...AllPrimitiveTypes,
//             PQP.Language.Constant.LanguageConstantKind.Nullable,
//         ]);
//     });

//     it("(a, |", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(`(a, |`);

//         TestUtils.containsCompletionItemLabels(result, [PQP.Language.Constant.LanguageConstantKind.Optional]);
//     });

//     it("(a, op|", async () => {
//         const result: ReadonlyArray<CompletionItem> = await TestUtils.getCompletionItems(`(a, op|`);

//         TestUtils.containsCompletionItemLabels(result, [PQP.Language.Constant.LanguageConstantKind.Optional]);
//     });
// });
