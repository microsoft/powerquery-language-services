// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver-types";
import { Keyword, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { AutocompleteItemUtils } from "../../../powerquery-language-services/inspection/autocomplete/autocompleteItem";
import { AutocompleteItem } from "../../../powerquery-language-services/inspection/autocomplete/autocompleteItem/autocompleteItem";
import { Library, LibraryDefinitionUtils } from "../../../powerquery-language-services";

describe("AutocompleteItemUtils", () => {
    describe("createSnippetItems", () => {
        let snippetItems: ReadonlyArray<AutocompleteItem>;

        before(() => {
            snippetItems = AutocompleteItemUtils.createSnippetItems();
        });

        it("returns exactly 4 items", () => {
            expect(snippetItems).to.have.lengthOf(4);
        });

        it("let...in snippet has correct properties", () => {
            const letSnippet: AutocompleteItem | undefined = snippetItems.find(
                (item: AutocompleteItem) => item.label === "let...in",
            );

            expect(letSnippet).to.not.equal(undefined);
            expect(letSnippet!.kind).to.equal(CompletionItemKind.Snippet);
            expect(letSnippet!.insertTextFormat).to.equal(InsertTextFormat.Snippet);
            expect(letSnippet!.insertText).to.equal("let\n\t${1:name} = ${2:value}\nin\n\t${0:result}");
        });

        it("if...then...else snippet has correct properties", () => {
            const ifSnippet: AutocompleteItem | undefined = snippetItems.find(
                (item: AutocompleteItem) => item.label === "if...then...else",
            );

            expect(ifSnippet).to.not.equal(undefined);
            expect(ifSnippet!.kind).to.equal(CompletionItemKind.Snippet);
            expect(ifSnippet!.insertTextFormat).to.equal(InsertTextFormat.Snippet);
            expect(ifSnippet!.insertText).to.equal(
                "if ${1:condition} then ${2:trueValue} else ${3:falseValue}",
            );
        });

        it("try...otherwise snippet has correct properties", () => {
            const trySnippet: AutocompleteItem | undefined = snippetItems.find(
                (item: AutocompleteItem) => item.label === "try...otherwise",
            );

            expect(trySnippet).to.not.equal(undefined);
            expect(trySnippet!.kind).to.equal(CompletionItemKind.Snippet);
            expect(trySnippet!.insertTextFormat).to.equal(InsertTextFormat.Snippet);
            expect(trySnippet!.insertText).to.equal("try ${1:expression} otherwise ${2:default}");
        });

        it("each snippet has correct properties", () => {
            const eachSnippet: AutocompleteItem | undefined = snippetItems.find(
                (item: AutocompleteItem) => item.label === "each",
            );

            expect(eachSnippet).to.not.equal(undefined);
            expect(eachSnippet!.kind).to.equal(CompletionItemKind.Snippet);
            expect(eachSnippet!.insertTextFormat).to.equal(InsertTextFormat.Snippet);
            expect(eachSnippet!.insertText).to.equal("each ${0:expression}");
        });

        it("all snippets have jaroWinklerScore of 1", () => {
            for (const snippet of snippetItems) {
                expect(snippet.jaroWinklerScore).to.equal(1, `expected jaroWinklerScore of 1 for "${snippet.label}"`);
            }
        });

        it("all snippets have powerQueryType of NotApplicableInstance", () => {
            for (const snippet of snippetItems) {
                expect(snippet.powerQueryType).to.equal(
                    Type.NotApplicableInstance,
                    `expected NotApplicableInstance for "${snippet.label}"`,
                );
            }
        });
    });

    describe("fromKeywordKind", () => {
        it("creates keyword item with commitCharacters [' ']", () => {
            const item: AutocompleteItem = AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.Let);
            expect(item.commitCharacters).to.deep.equal([" "]);
        });

        it("creates keyword item with kind Keyword", () => {
            const item: AutocompleteItem = AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.If);
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        it("has jaroWinklerScore of 1 when no other text", () => {
            const item: AutocompleteItem = AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.Then);
            expect(item.jaroWinklerScore).to.equal(1);
        });

        it("has label matching the keyword kind", () => {
            const item: AutocompleteItem = AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.Let);
            expect(item.label).to.equal("let");
        });

        it("has powerQueryType of NotApplicableInstance", () => {
            const item: AutocompleteItem = AutocompleteItemUtils.fromKeywordKind(Keyword.KeywordKind.Let);
            expect(item.powerQueryType).to.equal(Type.NotApplicableInstance);
        });
    });

    describe("fromLibraryDefinition", () => {
        const functionDef: Library.LibraryFunction = LibraryDefinitionUtils.functionDefinition(
            "TestFunc",
            "Test function description",
            TypeUtils.definedFunction(false, [], Type.AnyInstance),
            CompletionItemKind.Function,
            [],
        );

        const constantDef: Library.LibraryConstant = LibraryDefinitionUtils.constantDefinition(
            "TestConst",
            "Test constant description",
            Type.NumberInstance,
            CompletionItemKind.Constant,
        );

        describe("commitCharacters", () => {
            it("function definition has commitCharacters ['(']", () => {
                const item: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestFunc",
                    functionDef,
                );

                expect(item.commitCharacters).to.deep.equal(["("]);
            });

            it("constant definition has commitCharacters undefined", () => {
                const item: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestConst",
                    constantDef,
                );

                expect(item.commitCharacters).to.equal(undefined);
            });
        });

        describe("documentation", () => {
            it("function definition has PlainText documentation with description", () => {
                const item: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestFunc",
                    functionDef,
                );

                expect(item.documentation).to.deep.equal({
                    kind: MarkupKind.PlainText,
                    value: "Test function description",
                });
            });

            it("constant definition has PlainText documentation with description", () => {
                const item: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestConst",
                    constantDef,
                );

                expect(item.documentation).to.deep.equal({
                    kind: MarkupKind.PlainText,
                    value: "Test constant description",
                });
            });
        });

        describe("jaroWinklerScore", () => {
            it("has jaroWinklerScore of 1 when no other text", () => {
                const item: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestFunc",
                    functionDef,
                );

                expect(item.jaroWinklerScore).to.equal(1);
            });
        });

        describe("kind", () => {
            it("uses completionItemKind from library definition", () => {
                const funcItem: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestFunc",
                    functionDef,
                );

                expect(funcItem.kind).to.equal(CompletionItemKind.Function);

                const constItem: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestConst",
                    constantDef,
                );

                expect(constItem.kind).to.equal(CompletionItemKind.Constant);
            });
        });

        describe("powerQueryType", () => {
            it("uses asPowerQueryType from library definition", () => {
                const item: AutocompleteItem = AutocompleteItemUtils.fromLibraryDefinition(
                    "TestConst",
                    constantDef,
                );

                expect(item.powerQueryType).to.equal(Type.NumberInstance);
            });
        });
    });
});
