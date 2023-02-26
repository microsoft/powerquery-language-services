// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    ExpressionKeywordKinds,
    KeywordKind,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/keyword/keyword";
import { Assert } from "@microsoft/powerquery-parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

async function assertContainsAutocompleteItemLabels(
    textWithPosition: string,
    expected: ReadonlyArray<KeywordKind>,
): Promise<void> {
    const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPosition);

    const actual: Inspection.Autocomplete = await TestUtils.assertGetAutocomplete(
        TestConstants.DefaultInspectionSettings,
        text,
        position,
    );

    Assert.isOk(actual.triedKeyword);

    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedKeyword.value);
}

describe(`Inspection - Autocomplete - Keyword`, () => {
    it(`|`, () => assertContainsAutocompleteItemLabels("|", [...ExpressionKeywordKinds, KeywordKind.Section]));

    describe("partial keyword", () => {
        it(`a|`, () => assertContainsAutocompleteItemLabels("|", []));

        it(`x a|`, () => assertContainsAutocompleteItemLabels("x a|", [KeywordKind.And, KeywordKind.As]));

        it(`e|`, () => assertContainsAutocompleteItemLabels("e|", [KeywordKind.Each, KeywordKind.Error]));

        it(`if x then x e|`, () => assertContainsAutocompleteItemLabels("if x then x e|", [KeywordKind.Else]));

        it(`i|`, () => assertContainsAutocompleteItemLabels("i|", [KeywordKind.If]));

        it(`l|`, () => assertContainsAutocompleteItemLabels("l|", [KeywordKind.Let]));

        it(`m|`, () => assertContainsAutocompleteItemLabels("m|", []));

        it(`x m|`, () => assertContainsAutocompleteItemLabels("x m|", [KeywordKind.Meta]));

        it(`n|`, () => assertContainsAutocompleteItemLabels("n|", [KeywordKind.Not]));

        it(`true o|`, () => assertContainsAutocompleteItemLabels("true o|", [KeywordKind.Or]));

        it(`try true o|`, () =>
            assertContainsAutocompleteItemLabels("try true o|", [KeywordKind.Or, KeywordKind.Otherwise]));

        it(`try true o |`, () => assertContainsAutocompleteItemLabels("|", []));

        it(`try true ot|`, () => assertContainsAutocompleteItemLabels("try true ot|", [KeywordKind.Otherwise]));

        it(`try true oth|`, () => assertContainsAutocompleteItemLabels("try true oth|", [KeywordKind.Otherwise]));

        it(`s|`, () => assertContainsAutocompleteItemLabels("s|", [KeywordKind.Section]));

        it(`[] |`, () => assertContainsAutocompleteItemLabels("[] |", [KeywordKind.Section]));

        it(`[] |s`, () => assertContainsAutocompleteItemLabels("[] |s", []));

        it(`[] s|`, () => assertContainsAutocompleteItemLabels("[] s|", [KeywordKind.Section]));

        it(`[] s |`, () => assertContainsAutocompleteItemLabels("[] s |", []));

        it(`section; s|`, () => assertContainsAutocompleteItemLabels("section; s|", [KeywordKind.Shared]));

        it(`section; shared x|`, () => assertContainsAutocompleteItemLabels("section; shared x|", []));

        it(`section; [] s|`, () => assertContainsAutocompleteItemLabels("section; [] s|", [KeywordKind.Shared]));

        it(`if true t|`, () => assertContainsAutocompleteItemLabels("if true t|", [KeywordKind.Then]));

        it(`t|`, () =>
            assertContainsAutocompleteItemLabels("t|", [KeywordKind.True, KeywordKind.Try, KeywordKind.Type]));
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => assertContainsAutocompleteItemLabels("try |", ExpressionKeywordKinds));

        it(`try true|`, () => assertContainsAutocompleteItemLabels("try true|", [KeywordKind.True]));

        it(`try true |`, () =>
            assertContainsAutocompleteItemLabels("try true |", [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.Otherwise,
            ]));
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => assertContainsAutocompleteItemLabels("if |error", ExpressionKeywordKinds));

        it(`if error|`, () => assertContainsAutocompleteItemLabels("if error|", []));

        it(`error |`, () => assertContainsAutocompleteItemLabels("error |", ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () =>
            assertContainsAutocompleteItemLabels("let x = (_ |) => a in x", [KeywordKind.As]));

        it(`let x = (_ a|) => a in`, () =>
            assertContainsAutocompleteItemLabels("let x = (_ a|) => a in", [KeywordKind.As]));
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => assertContainsAutocompleteItemLabels("if|", []));

        it(`if |`, () => assertContainsAutocompleteItemLabels("if |", ExpressionKeywordKinds));

        it(`if 1|`, () => assertContainsAutocompleteItemLabels("if 1|", []));

        it(`if |if`, () => assertContainsAutocompleteItemLabels("if |if", ExpressionKeywordKinds));

        it(`if i|f`, () => assertContainsAutocompleteItemLabels("if i|f", [KeywordKind.If]));

        it(`if if |`, () => assertContainsAutocompleteItemLabels("if if |", ExpressionKeywordKinds));

        it(`if 1 |`, () => assertContainsAutocompleteItemLabels("if 1 |", [KeywordKind.Then]));

        it(`if 1 t|`, () => assertContainsAutocompleteItemLabels("if 1 t|", [KeywordKind.Then]));

        it(`if 1 then |`, () => assertContainsAutocompleteItemLabels("if 1 then |", ExpressionKeywordKinds));

        it(`if 1 then 1|`, () => assertContainsAutocompleteItemLabels("if 1 then 1|", []));

        it(`if 1 then 1 e|`, () => assertContainsAutocompleteItemLabels("if 1 then 1 e|", [KeywordKind.Else]));

        it(`if 1 then 1 else|`, () => assertContainsAutocompleteItemLabels("if 1 then 1 else|", []));

        it(`if 1 th|en 1 else`, () => assertContainsAutocompleteItemLabels(`if 1 th|en 1 else`, [KeywordKind.Then]));

        it(`if 1 then 1 else |`, () =>
            assertContainsAutocompleteItemLabels(`if 1 then 1 else |`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => assertContainsAutocompleteItemLabels(`foo(|`, ExpressionKeywordKinds));

        it(`foo(a|`, () => assertContainsAutocompleteItemLabels(`foo(a|`, []));

        it(`foo(a|,`, () => assertContainsAutocompleteItemLabels(`foo(a|,`, []));

        it(`foo(a,|`, () => assertContainsAutocompleteItemLabels(`foo(a,|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => assertContainsAutocompleteItemLabels(`{|`, ExpressionKeywordKinds));

        it(`{1|`, () => assertContainsAutocompleteItemLabels(`{1|`, []));

        it(`{1|,`, () => assertContainsAutocompleteItemLabels(`{1|,`, []));

        it(`{1,|`, () => assertContainsAutocompleteItemLabels(`{1,|`, ExpressionKeywordKinds));

        it(`{1,|2`, () => assertContainsAutocompleteItemLabels(`{1,|2`, ExpressionKeywordKinds));

        it(`{1,|2,`, () => assertContainsAutocompleteItemLabels(`{1,|2,`, ExpressionKeywordKinds));

        it(`{1..|`, () => assertContainsAutocompleteItemLabels(`{1..|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => assertContainsAutocompleteItemLabels(`try true otherwise| false`, []));

        it(`try true otherwise |false`, () =>
            assertContainsAutocompleteItemLabels(`try true otherwise |false`, ExpressionKeywordKinds));

        it(`try true oth|`, () => assertContainsAutocompleteItemLabels(`try true oth|`, [KeywordKind.Otherwise]));

        it(`try true otherwise |`, () =>
            assertContainsAutocompleteItemLabels(`try true otherwise |`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => assertContainsAutocompleteItemLabels(`+(|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => assertContainsAutocompleteItemLabels(`+[|`, []));

        it(`+[a=|`, () => assertContainsAutocompleteItemLabels(`+[a=|`, ExpressionKeywordKinds));

        it(`+[a=1|`, () => assertContainsAutocompleteItemLabels(`+[a=1|`, []));

        it(`+[a|=1`, () => assertContainsAutocompleteItemLabels(`+[a|=1`, []));

        it(`+[a=1|]`, () => assertContainsAutocompleteItemLabels(`+[a=1|]`, []));

        it(`+[a=|1]`, () => assertContainsAutocompleteItemLabels(`+[a=|1]`, ExpressionKeywordKinds));

        it(`+[a=1|,`, () => assertContainsAutocompleteItemLabels(`+[a=1|,`, []));

        it(`+[a=1,|`, () => assertContainsAutocompleteItemLabels(`+[a=1,|`, []));

        it(`+[a=1|,b`, () => assertContainsAutocompleteItemLabels(`+[a=1|,b`, []));

        it(`+[a=1|,b=`, () => assertContainsAutocompleteItemLabels(`+[a=1|,b=`, []));

        it(`+[a=|1,b=`, () => assertContainsAutocompleteItemLabels(`+[a=|1,b=`, ExpressionKeywordKinds));

        it(`+[a=1,b=2|`, () => assertContainsAutocompleteItemLabels(`+[a=1,b=2|`, []));

        it(`+[a=1,b=2 |`, () => assertContainsAutocompleteItemLabels(`+[a=1,b=2 |`, []));
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => assertContainsAutocompleteItemLabels(`error |`, ExpressionKeywordKinds));

        it(`let x = |`, () => assertContainsAutocompleteItemLabels(`let x = |`, ExpressionKeywordKinds));

        it(`() => |`, () => assertContainsAutocompleteItemLabels(`() => |`, ExpressionKeywordKinds));

        it(`if |`, () => assertContainsAutocompleteItemLabels(`if |`, ExpressionKeywordKinds));

        it(`if true then |`, () => assertContainsAutocompleteItemLabels(`if true then |`, ExpressionKeywordKinds));

        it(`if true then true else |`, () =>
            assertContainsAutocompleteItemLabels(`if true then true else |`, ExpressionKeywordKinds));

        it(`foo(|`, () => assertContainsAutocompleteItemLabels(`foo(|`, ExpressionKeywordKinds));

        it(`let x = 1 in |`, () => assertContainsAutocompleteItemLabels(`let x = 1 in |`, ExpressionKeywordKinds));

        it(`+{|`, () => assertContainsAutocompleteItemLabels(`+{|`, ExpressionKeywordKinds));

        it(`try true otherwise |`, () =>
            assertContainsAutocompleteItemLabels(`try true otherwise |`, ExpressionKeywordKinds));

        it(`+(|`, () => assertContainsAutocompleteItemLabels(`+(|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => assertContainsAutocompleteItemLabels(`section; [] |`, [KeywordKind.Shared]));

        it(`section; [] x |`, () => assertContainsAutocompleteItemLabels(`section; [] x |`, []));

        it(`section; x = |`, () => assertContainsAutocompleteItemLabels(`section; x = |`, ExpressionKeywordKinds));

        it(`section; x = 1 |`, () =>
            assertContainsAutocompleteItemLabels(`section; x = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
            ]));

        it(`section; x = 1 i|`, () => assertContainsAutocompleteItemLabels(`section; x = 1 i|`, [KeywordKind.Is]));

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () =>
            assertContainsAutocompleteItemLabels(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
                ExpressionKeywordKinds,
            ));
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => assertContainsAutocompleteItemLabels(`let a = |`, ExpressionKeywordKinds));

        it(`let a = 1|`, () => assertContainsAutocompleteItemLabels(`let a = 1|`, []));

        it(`let a = 1 |`, () =>
            assertContainsAutocompleteItemLabels(`let a = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = 1 | foobar`, () =>
            assertContainsAutocompleteItemLabels(`let a = 1 | foobar`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = 1 i|`, () =>
            assertContainsAutocompleteItemLabels(`let a = 1 i|`, [KeywordKind.Is, KeywordKind.In]));

        it(`let a = 1 o|`, () => assertContainsAutocompleteItemLabels(`let a = 1 o|`, [KeywordKind.Or]));

        it(`let a = 1 m|`, () => assertContainsAutocompleteItemLabels(`let a = 1 m|`, [KeywordKind.Meta]));

        it(`let a = 1, |`, () => assertContainsAutocompleteItemLabels(`let a = 1, |`, []));

        it(`let a = let b = |`, () =>
            assertContainsAutocompleteItemLabels(`let a = let b = |`, ExpressionKeywordKinds));

        it(`let a = let b = 1 |`, () =>
            assertContainsAutocompleteItemLabels(`let a = let b = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = let b = 1, |`, () => assertContainsAutocompleteItemLabels(`let a = let b = 1, |`, []));

        it(`let x = e|`, () =>
            assertContainsAutocompleteItemLabels(`let x = e|`, [KeywordKind.Each, KeywordKind.Error]));

        it(`let x = error let x = e|`, () =>
            assertContainsAutocompleteItemLabels(`let x = error let x = e|`, [KeywordKind.Each, KeywordKind.Error]));
    });
});
