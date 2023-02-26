// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import {
    ExpressionKeywordKinds,
    KeywordKind,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/keyword/keyword";
import { Assert } from "@microsoft/powerquery-parser";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - Keyword`, () => {
    async function runTest(textWithPipe: string, expected: ReadonlyArray<KeywordKind>): Promise<void> {
        const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection(
            TestConstants.DefaultInspectionSettings,
            textWithPipe,
        );

        Assert.isOk(actual.triedKeyword);

        TestUtils.assertContainsAutocompleteItemLabels(expected, actual.triedKeyword.value);
    }

    it(`|`, () => runTest("|", [...ExpressionKeywordKinds, KeywordKind.Section]));

    describe("partial keyword", () => {
        it(`a|`, () => runTest("|", []));

        it(`x a|`, () => runTest("x a|", [KeywordKind.And, KeywordKind.As]));

        it(`e|`, () => runTest("e|", [KeywordKind.Each, KeywordKind.Error]));

        it(`if x then x e|`, () => runTest("if x then x e|", [KeywordKind.Else]));

        it(`i|`, () => runTest("i|", [KeywordKind.If]));

        it(`l|`, () => runTest("l|", [KeywordKind.Let]));

        it(`m|`, () => runTest("m|", []));

        it(`x m|`, () => runTest("x m|", [KeywordKind.Meta]));

        it(`n|`, () => runTest("n|", [KeywordKind.Not]));

        it(`true o|`, () => runTest("true o|", [KeywordKind.Or]));

        it(`try true o|`, () => runTest("try true o|", [KeywordKind.Or, KeywordKind.Otherwise]));

        it(`try true o |`, () => runTest("|", []));

        it(`try true ot|`, () => runTest("try true ot|", [KeywordKind.Otherwise]));

        it(`try true oth|`, () => runTest("try true oth|", [KeywordKind.Otherwise]));

        it(`s|`, () => runTest("s|", [KeywordKind.Section]));

        it(`[] |`, () => runTest("[] |", [KeywordKind.Section]));

        it(`[] |s`, () => runTest("[] |s", []));

        it(`[] s|`, () => runTest("[] s|", [KeywordKind.Section]));

        it(`[] s |`, () => runTest("[] s |", []));

        it(`section; s|`, () => runTest("section; s|", [KeywordKind.Shared]));

        it(`section; shared x|`, () => runTest("section; shared x|", []));

        it(`section; [] s|`, () => runTest("section; [] s|", [KeywordKind.Shared]));

        it(`if true t|`, () => runTest("if true t|", [KeywordKind.Then]));

        it(`t|`, () => runTest("t|", [KeywordKind.True, KeywordKind.Try, KeywordKind.Type]));
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => runTest("try |", ExpressionKeywordKinds));

        it(`try true|`, () => runTest("try true|", [KeywordKind.True]));

        it(`try true |`, () =>
            runTest("try true |", [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.Otherwise,
            ]));
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => runTest("if |error", ExpressionKeywordKinds));

        it(`if error|`, () => runTest("if error|", []));

        it(`error |`, () => runTest("error |", ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () => runTest("let x = (_ |) => a in x", [KeywordKind.As]));

        it(`let x = (_ a|) => a in`, () => runTest("let x = (_ a|) => a in", [KeywordKind.As]));
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => runTest("if|", []));

        it(`if |`, () => runTest("if |", ExpressionKeywordKinds));

        it(`if 1|`, () => runTest("if 1|", []));

        it(`if |if`, () => runTest("if |if", ExpressionKeywordKinds));

        it(`if i|f`, () => runTest("if i|f", [KeywordKind.If]));

        it(`if if |`, () => runTest("if if |", ExpressionKeywordKinds));

        it(`if 1 |`, () => runTest("if 1 |", [KeywordKind.Then]));

        it(`if 1 t|`, () => runTest("if 1 t|", [KeywordKind.Then]));

        it(`if 1 then |`, () => runTest("if 1 then |", ExpressionKeywordKinds));

        it(`if 1 then 1|`, () => runTest("if 1 then 1|", []));

        it(`if 1 then 1 e|`, () => runTest("if 1 then 1 e|", [KeywordKind.Else]));

        it(`if 1 then 1 else|`, () => runTest("if 1 then 1 else|", []));

        it(`if 1 th|en 1 else`, () => runTest(`if 1 th|en 1 else`, [KeywordKind.Then]));

        it(`if 1 then 1 else |`, () => runTest(`if 1 then 1 else |`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => runTest(`foo(|`, ExpressionKeywordKinds));

        it(`foo(a|`, () => runTest(`foo(a|`, []));

        it(`foo(a|,`, () => runTest(`foo(a|,`, []));

        it(`foo(a,|`, () => runTest(`foo(a,|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => runTest(`{|`, ExpressionKeywordKinds));

        it(`{1|`, () => runTest(`{1|`, []));

        it(`{1|,`, () => runTest(`{1|,`, []));

        it(`{1,|`, () => runTest(`{1,|`, ExpressionKeywordKinds));

        it(`{1,|2`, () => runTest(`{1,|2`, ExpressionKeywordKinds));

        it(`{1,|2,`, () => runTest(`{1,|2,`, ExpressionKeywordKinds));

        it(`{1..|`, () => runTest(`{1..|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => runTest(`try true otherwise| false`, []));

        it(`try true otherwise |false`, () => runTest(`try true otherwise |false`, ExpressionKeywordKinds));

        it(`try true oth|`, () => runTest(`try true oth|`, [KeywordKind.Otherwise]));

        it(`try true otherwise |`, () => runTest(`try true otherwise |`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => runTest(`+(|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => runTest(`+[|`, []));

        it(`+[a=|`, () => runTest(`+[a=|`, ExpressionKeywordKinds));

        it(`+[a=1|`, () => runTest(`+[a=1|`, []));

        it(`+[a|=1`, () => runTest(`+[a|=1`, []));

        it(`+[a=1|]`, () => runTest(`+[a=1|]`, []));

        it(`+[a=|1]`, () => runTest(`+[a=|1]`, ExpressionKeywordKinds));

        it(`+[a=1|,`, () => runTest(`+[a=1|,`, []));

        it(`+[a=1,|`, () => runTest(`+[a=1,|`, []));

        it(`+[a=1|,b`, () => runTest(`+[a=1|,b`, []));

        it(`+[a=1|,b=`, () => runTest(`+[a=1|,b=`, []));

        it(`+[a=|1,b=`, () => runTest(`+[a=|1,b=`, ExpressionKeywordKinds));

        it(`+[a=1,b=2|`, () => runTest(`+[a=1,b=2|`, []));

        it(`+[a=1,b=2 |`, () => runTest(`+[a=1,b=2 |`, []));
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => runTest(`error |`, ExpressionKeywordKinds));

        it(`let x = |`, () => runTest(`let x = |`, ExpressionKeywordKinds));

        it(`() => |`, () => runTest(`() => |`, ExpressionKeywordKinds));

        it(`if |`, () => runTest(`if |`, ExpressionKeywordKinds));

        it(`if true then |`, () => runTest(`if true then |`, ExpressionKeywordKinds));

        it(`if true then true else |`, () => runTest(`if true then true else |`, ExpressionKeywordKinds));

        it(`foo(|`, () => runTest(`foo(|`, ExpressionKeywordKinds));

        it(`let x = 1 in |`, () => runTest(`let x = 1 in |`, ExpressionKeywordKinds));

        it(`+{|`, () => runTest(`+{|`, ExpressionKeywordKinds));

        it(`try true otherwise |`, () => runTest(`try true otherwise |`, ExpressionKeywordKinds));

        it(`+(|`, () => runTest(`+(|`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => runTest(`section; [] |`, [KeywordKind.Shared]));

        it(`section; [] x |`, () => runTest(`section; [] x |`, []));

        it(`section; x = |`, () => runTest(`section; x = |`, ExpressionKeywordKinds));

        it(`section; x = 1 |`, () =>
            runTest(`section; x = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
            ]));

        it(`section; x = 1 i|`, () => runTest(`section; x = 1 i|`, [KeywordKind.Is]));

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () =>
            runTest(`section foo; a = () => true; b = "string"; c = 1; d = |;`, ExpressionKeywordKinds));
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => runTest(`let a = |`, ExpressionKeywordKinds));

        it(`let a = 1|`, () => runTest(`let a = 1|`, []));

        it(`let a = 1 |`, () =>
            runTest(`let a = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = 1 | foobar`, () =>
            runTest(`let a = 1 | foobar`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = 1 i|`, () => runTest(`let a = 1 i|`, [KeywordKind.Is, KeywordKind.In]));

        it(`let a = 1 o|`, () => runTest(`let a = 1 o|`, [KeywordKind.Or]));

        it(`let a = 1 m|`, () => runTest(`let a = 1 m|`, [KeywordKind.Meta]));

        it(`let a = 1, |`, () => runTest(`let a = 1, |`, []));

        it(`let a = let b = |`, () => runTest(`let a = let b = |`, ExpressionKeywordKinds));

        it(`let a = let b = 1 |`, () =>
            runTest(`let a = let b = 1 |`, [
                KeywordKind.And,
                KeywordKind.As,
                KeywordKind.Is,
                KeywordKind.Meta,
                KeywordKind.Or,
                KeywordKind.In,
            ]));

        it(`let a = let b = 1, |`, () => runTest(`let a = let b = 1, |`, []));

        it(`let x = e|`, () => runTest(`let x = e|`, [KeywordKind.Each, KeywordKind.Error]));

        it(`let x = error let x = e|`, () =>
            runTest(`let x = error let x = e|`, [KeywordKind.Each, KeywordKind.Error]));
    });
});
