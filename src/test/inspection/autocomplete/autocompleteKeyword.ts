// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import {
    ExpressionKeywordKinds,
    KeywordKind,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/keyword/keyword";
import { Assert } from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

async function assertKeywordAutocomplete(
    textWithPosition: string,
    expected: ReadonlyArray<KeywordKind>,
): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPosition);

    const actual: Inspection.Autocomplete = await TestUtils.assertGetAutocomplete(
        TestConstants.DefaultInspectionSettings,
        text,
        position,
    );

    Assert.isOk(actual.triedKeyword);

    TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedKeyword.value);

    return actual.triedKeyword.value;
}

describe(`Inspection - Autocomplete - Keyword`, () => {
    it(`|`, () => assertKeywordAutocomplete("|", [...Keyword.ExpressionKeywordKinds, KeywordKind.Section]));

    describe("partial keyword", () => {
        it(`a|`, () => assertKeywordAutocomplete("|", []));

        it(`x a|`, () => assertKeywordAutocomplete("x a|", [KeywordKind.And, KeywordKind.As]));

        it(`e|`, () => assertKeywordAutocomplete("e|", [KeywordKind.Each, KeywordKind.Error]));

        it(`if x then x e|`, () => assertKeywordAutocomplete("if x then x e|", [KeywordKind.Else]));

        it(`i|`, () => assertKeywordAutocomplete("i|", [KeywordKind.If]));

        it(`l|`, () => assertKeywordAutocomplete("l|", [KeywordKind.Let]));

        it(`m|`, () => assertKeywordAutocomplete("m|", []));

        it(`x m|`, () => assertKeywordAutocomplete("x m|", [KeywordKind.Meta]));

        it(`n|`, () => assertKeywordAutocomplete("n|", [KeywordKind.Not]));

        it(`true o|`, () => assertKeywordAutocomplete("true o|", [KeywordKind.Or]));

        it(`try true o|`, () => assertKeywordAutocomplete("try true o|", [KeywordKind.Or, KeywordKind.Otherwise]));

        it(`try true o |`, () => assertKeywordAutocomplete("|", []));

        it(`try true ot|`, () => assertKeywordAutocomplete("try true ot|", [KeywordKind.Otherwise]));

        it(`try true oth|`, () => assertKeywordAutocomplete("try true oth|", [KeywordKind.Otherwise]));

        it(`s|`, () => assertKeywordAutocomplete("s|", [KeywordKind.Section]));

        it(`[] |`, () => assertKeywordAutocomplete("[] |", [KeywordKind.Section]));

        it(`[] |s`, () => assertKeywordAutocomplete("[] |s", []));

        it(`[] s|`, () => assertKeywordAutocomplete("[] s|", [KeywordKind.Section]));

        it(`[] s |`, () => assertKeywordAutocomplete("[] s |", []));

        it(`section; s|`, () => assertKeywordAutocomplete("section; s|", [KeywordKind.Shared]));

        it(`section; shared x|`, () => assertKeywordAutocomplete("section; shared x|", []));

        it(`section; [] s|`, () => assertKeywordAutocomplete("section; [] s|", [KeywordKind.Shared]));

        it(`if true t|`, () => assertKeywordAutocomplete("if true t|", [KeywordKind.Then]));

        it(`t|`, () => assertKeywordAutocomplete("t|", [KeywordKind.True, KeywordKind.Try, KeywordKind.Type]));
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => assertKeywordAutocomplete("try |", ExpressionKeywordKinds));

        it(`try true|`, () => assertKeywordAutocomplete("try true|", [KeywordKind.True]));

        it(`try true |`, () =>
            assertKeywordAutocomplete("try true |", [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.Otherwise,
            ]));
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => assertKeywordAutocomplete("if |error", ExpressionKeywordKinds));

        it(`if error|`, () => assertKeywordAutocomplete("if error|", []));

        it(`error |`, () => assertKeywordAutocomplete("error |", ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () => assertKeywordAutocomplete("let x = (_ |) => a in x", [KeywordKind.As]));

        it(`let x = (_ a|) => a in`, () => assertKeywordAutocomplete("let x = (_ a|) => a in", [KeywordKind.As]));
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => assertKeywordAutocomplete("if|", []));

        it(`if |`, () => assertKeywordAutocomplete("if |", ExpressionKeywordKinds));

        it(`if 1|`, () => assertKeywordAutocomplete("if 1|", []));

        it(`if |if`, () => assertKeywordAutocomplete("if |if", ExpressionKeywordKinds));

        it(`if i|f`, () => assertKeywordAutocomplete("if i|f", [KeywordKind.If]));

        it(`if if |`, () => assertKeywordAutocomplete("if if |", ExpressionKeywordKinds));

        it(`if 1 |`, () => assertKeywordAutocomplete("if 1 |", [KeywordKind.Then]));

        it(`if 1 t|`, () => assertKeywordAutocomplete("if 1 t|", [KeywordKind.Then]));

        it(`if 1 then |`, () => assertKeywordAutocomplete("if 1 then |", ExpressionKeywordKinds));

        it(`if 1 then 1|`, () => assertKeywordAutocomplete("if 1 then 1|", []));

        it(`if 1 then 1 e|`, () => assertKeywordAutocomplete("if 1 then 1 e|", [KeywordKind.Else]));

        it(`if 1 then 1 else|`, () => assertKeywordAutocomplete("if 1 then 1 else|", []));

        it(`if 1 th|en 1 else`, () => assertKeywordAutocomplete(`if 1 th|en 1 else`, [KeywordKind.Then]));

        it(`if 1 then 1 else |`, () => assertKeywordAutocomplete(`if 1 then 1 else |`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => assertKeywordAutocomplete(`foo(|`, ExpressionKeywordKinds));

        it(`foo(a|`, () => assertKeywordAutocomplete(`foo(a|`, []));

        it(`foo(a|,`, () => assertKeywordAutocomplete(`foo(a|,`, []));

        it(`foo(a,|`, () => assertKeywordAutocomplete(`foo(a,|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => assertKeywordAutocomplete(`{|`, ExpressionKeywordKinds));

        it(`{1|`, () => assertKeywordAutocomplete(`{1|`, []));

        it(`{1|,`, () => assertKeywordAutocomplete(`{1|,`, []));

        it(`{1,|`, () => assertKeywordAutocomplete(`{1,|`, ExpressionKeywordKinds));

        it(`{1,|2`, () => assertKeywordAutocomplete(`{1,|2`, ExpressionKeywordKinds));

        it(`{1,|2,`, () => assertKeywordAutocomplete(`{1,|2,`, ExpressionKeywordKinds));

        it(`{1..|`, () => assertKeywordAutocomplete(`{1..|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => assertKeywordAutocomplete(`try true otherwise| false`, []));

        it(`try true otherwise |false`, () =>
            assertKeywordAutocomplete(`try true otherwise |false`, ExpressionKeywordKinds));

        it(`try true oth|`, () => assertKeywordAutocomplete(`try true oth|`, [KeywordKind.Otherwise]));

        it(`try true otherwise |`, () => assertKeywordAutocomplete(`try true otherwise |`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => assertKeywordAutocomplete(`+(|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => assertKeywordAutocomplete(`+[|`, []));

        it(`+[a=|`, () => assertKeywordAutocomplete(`+[a=|`, ExpressionKeywordKinds));

        it(`+[a=1|`, () => assertKeywordAutocomplete(`+[a=1|`, []));

        it(`+[a|=1`, () => assertKeywordAutocomplete(`+[a|=1`, []));

        it(`+[a=1|]`, () => assertKeywordAutocomplete(`+[a=1|]`, []));

        it(`+[a=|1]`, () => assertKeywordAutocomplete(`+[a=|1]`, ExpressionKeywordKinds));

        it(`+[a=1|,`, () => assertKeywordAutocomplete(`+[a=1|,`, []));

        it(`+[a=1,|`, () => assertKeywordAutocomplete(`+[a=1,|`, []));

        it(`+[a=1|,b`, () => assertKeywordAutocomplete(`+[a=1|,b`, []));

        it(`+[a=1|,b=`, () => assertKeywordAutocomplete(`+[a=1|,b=`, []));

        it(`+[a=|1,b=`, () => assertKeywordAutocomplete(`+[a=|1,b=`, ExpressionKeywordKinds));

        it(`+[a=1,b=2|`, () => assertKeywordAutocomplete(`+[a=1,b=2|`, []));

        it(`+[a=1,b=2 |`, () => assertKeywordAutocomplete(`+[a=1,b=2 |`, []));
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => assertKeywordAutocomplete(`error |`, ExpressionKeywordKinds));

        it(`let x = |`, () => assertKeywordAutocomplete(`let x = |`, ExpressionKeywordKinds));

        it(`() => |`, () => assertKeywordAutocomplete(`() => |`, ExpressionKeywordKinds));

        it(`if |`, () => assertKeywordAutocomplete(`if |`, ExpressionKeywordKinds));

        it(`if true then |`, () => assertKeywordAutocomplete(`if true then |`, ExpressionKeywordKinds));

        it(`if true then true else |`, () =>
            assertKeywordAutocomplete(`if true then true else |`, ExpressionKeywordKinds));

        it(`foo(|`, () => assertKeywordAutocomplete(`foo(|`, ExpressionKeywordKinds));

        it(`let x = 1 in |`, () => assertKeywordAutocomplete(`let x = 1 in |`, ExpressionKeywordKinds));

        it(`+{|`, () => assertKeywordAutocomplete(`+{|`, ExpressionKeywordKinds));

        it(`try true otherwise |`, () => assertKeywordAutocomplete(`try true otherwise |`, ExpressionKeywordKinds));

        it(`+(|`, () => assertKeywordAutocomplete(`+(|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => assertKeywordAutocomplete(`section; [] |`, [KeywordKind.Shared]));

        it(`section; [] x |`, () => assertKeywordAutocomplete(`section; [] x |`, []));

        it(`section; x = |`, () => assertKeywordAutocomplete(`section; x = |`, ExpressionKeywordKinds));

        it(`section; x = 1 |`, () =>
            assertKeywordAutocomplete(`section; x = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
            ]));

        it(`section; x = 1 i|`, () => assertKeywordAutocomplete(`section; x = 1 i|`, [KeywordKind.Is]));

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () =>
            assertKeywordAutocomplete(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
                ExpressionKeywordKinds,
            ));
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => assertKeywordAutocomplete(`let a = |`, ExpressionKeywordKinds));

        it(`let a = 1|`, () => assertKeywordAutocomplete(`let a = 1|`, []));

        it(`let a = 1 |`, () =>
            assertKeywordAutocomplete(`let a = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = 1 | foobar`, () =>
            assertKeywordAutocomplete(`let a = 1 | foobar`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = 1 i|`, () => assertKeywordAutocomplete(`let a = 1 i|`, [KeywordKind.Is, KeywordKind.In]));

        it(`let a = 1 o|`, () => assertKeywordAutocomplete(`let a = 1 o|`, [KeywordKind.Or]));

        it(`let a = 1 m|`, () => assertKeywordAutocomplete(`let a = 1 m|`, [KeywordKind.Meta]));

        it(`let a = 1, |`, () => assertKeywordAutocomplete(`let a = 1, |`, []));

        it(`let a = let b = |`, () => assertKeywordAutocomplete(`let a = let b = |`, ExpressionKeywordKinds));

        it(`let a = let b = 1 |`, () =>
            assertKeywordAutocomplete(`let a = let b = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = let b = 1, |`, () => assertKeywordAutocomplete(`let a = let b = 1, |`, []));

        it(`let x = e|`, () => assertKeywordAutocomplete(`let x = e|`, [KeywordKind.Each, KeywordKind.Error]));

        it(`let x = error let x = e|`, () =>
            assertKeywordAutocomplete(`let x = error let x = e|`, [KeywordKind.Each, KeywordKind.Error]));
    });
});
