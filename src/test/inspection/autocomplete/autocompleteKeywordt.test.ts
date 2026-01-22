// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";
import {
    ExpressionKeywordKinds,
    KeywordKind,
} from "@microsoft/powerquery-parser/lib/powerquery-parser/language/keyword/keyword";
import { Ast } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { ResultUtils } from "@microsoft/powerquery-parser";

import { TestConstants, TestUtils } from "../..";
import { type Inspection } from "../../../powerquery-language-services";

describe(`Inspection - Autocomplete - Keyword`, () => {
    async function runTest(params: {
        readonly textWithPipe: string;
        readonly expected: ReadonlyArray<KeywordKind>;
    }): Promise<void> {
        const actual: Inspection.Autocomplete = await TestUtils.assertAutocompleteInspection({
            textWithPipe: params.textWithPipe,
            inspectionSettings: TestConstants.DefaultInspectionSettings,
        });

        ResultUtils.assertIsOk(actual.triedKeyword);

        const actualLabels: ReadonlyArray<string> = actual.triedKeyword.value.map(
            (item: Inspection.AutocompleteItem) => item.label,
        );

        expect(actualLabels).toEqual(expect.arrayContaining(params.expected));
    }

    it(`|`, async () =>
        await runTest({
            textWithPipe: "|",
            expected: [...ExpressionKeywordKinds, KeywordKind.Section],
        }));

    describe("partial keyword", () => {
        it(`a|`, async () =>
            await runTest({
                textWithPipe: "a|",
                expected: [],
            }));

        it(`x a|`, async () =>
            await runTest({
                textWithPipe: "x a|",
                expected: [KeywordKind.And, KeywordKind.As],
            }));

        it(`e|`, async () =>
            await runTest({
                textWithPipe: "e|",
                expected: [KeywordKind.Each, KeywordKind.Error],
            }));

        it(`if x then x e|`, async () =>
            await runTest({
                textWithPipe: "if x then x e|",
                expected: [KeywordKind.Else],
            }));

        it(`i|`, async () =>
            await runTest({
                textWithPipe: "i|",
                expected: [KeywordKind.If],
            }));

        it(`l|`, async () =>
            await runTest({
                textWithPipe: "l|",
                expected: [KeywordKind.Let],
            }));

        it(`m|`, async () =>
            await runTest({
                textWithPipe: "m|",
                expected: [],
            }));

        it(`x m|`, async () =>
            await runTest({
                textWithPipe: "x m|",
                expected: [KeywordKind.Meta],
            }));

        it(`n|`, async () =>
            await runTest({
                textWithPipe: "n|",
                expected: [KeywordKind.Not],
            }));

        it(`true o|`, async () =>
            await runTest({
                textWithPipe: "true o|",
                expected: [KeywordKind.Or],
            }));

        it(`try true o|`, async () =>
            await runTest({
                textWithPipe: "try true o|",
                expected: [KeywordKind.Or, KeywordKind.Otherwise],
            }));

        it(`try true o |`, async () =>
            await runTest({
                textWithPipe: "try true o |",
                expected: [],
            }));

        it(`try true ot|`, async () =>
            await runTest({
                textWithPipe: "try true ot|",
                expected: [KeywordKind.Otherwise],
            }));

        it(`try true oth|`, async () =>
            await runTest({
                textWithPipe: "try true oth|",
                expected: [KeywordKind.Otherwise],
            }));

        it(`s|`, async () =>
            await runTest({
                textWithPipe: "s|",
                expected: [KeywordKind.Section],
            }));

        it(`[] |`, async () =>
            await runTest({
                textWithPipe: "[] |",
                expected: [KeywordKind.Section],
            }));

        it(`[] |s`, async () =>
            await runTest({
                textWithPipe: "[] |s",
                expected: [],
            }));

        it(`[] s|`, async () =>
            await runTest({
                textWithPipe: "[] s|",
                expected: [KeywordKind.Section],
            }));

        it(`[] s |`, async () =>
            await runTest({
                textWithPipe: "[] s |",
                expected: [],
            }));

        it(`section; s|`, async () =>
            await runTest({
                textWithPipe: "section; s|",
                expected: [KeywordKind.Shared],
            }));

        it(`section; shared x|`, async () =>
            await runTest({
                textWithPipe: "section; shared x|",
                expected: [],
            }));

        it(`section; [] s|`, async () =>
            await runTest({
                textWithPipe: "section; [] s|",
                expected: [KeywordKind.Shared],
            }));

        it(`if true t|`, async () =>
            await runTest({
                textWithPipe: "if true t|",
                expected: [KeywordKind.Then],
            }));

        it(`t|`, async () =>
            await runTest({
                textWithPipe: "t|",
                expected: [KeywordKind.True, KeywordKind.Try, KeywordKind.Type],
            }));
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, async () =>
            await runTest({
                textWithPipe: "try |",
                expected: ExpressionKeywordKinds,
            }));

        it(`try true|`, async () =>
            await runTest({
                textWithPipe: "try true|",
                expected: [KeywordKind.True],
            }));

        it(`try true |`, async () =>
            await runTest({
                textWithPipe: "try true |",
                expected: [
                    KeywordKind.And,
                    KeywordKind.As,
                    KeywordKind.Is,
                    KeywordKind.Meta,
                    KeywordKind.Or,
                    KeywordKind.Otherwise,
                ],
            }));
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, async () =>
            await runTest({
                textWithPipe: "if |error",
                expected: ExpressionKeywordKinds,
            }));

        it(`if error|`, async () =>
            await runTest({
                textWithPipe: "if error|",
                expected: [],
            }));

        it(`error |`, async () =>
            await runTest({
                textWithPipe: "error |",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, async () =>
            await runTest({
                textWithPipe: "let x = (_ |) => a in x",
                expected: [KeywordKind.As],
            }));

        it(`let x = (_ a|) => a in`, async () =>
            await runTest({
                textWithPipe: "let x = (_ a|) => a in",
                expected: [KeywordKind.As],
            }));
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, async () =>
            await runTest({
                textWithPipe: "if|",
                expected: [],
            }));

        it(`if |`, async () =>
            await runTest({
                textWithPipe: "if |",
                expected: ExpressionKeywordKinds,
            }));

        it(`if 1|`, async () =>
            await runTest({
                textWithPipe: "if 1|",
                expected: [],
            }));

        it(`if |if`, async () =>
            await runTest({
                textWithPipe: "if |if",
                expected: ExpressionKeywordKinds,
            }));

        it(`if i|f`, async () =>
            await runTest({
                textWithPipe: "if i|f",
                expected: [KeywordKind.If],
            }));

        it(`if if |`, async () =>
            await runTest({
                textWithPipe: "if if |",
                expected: ExpressionKeywordKinds,
            }));

        it(`if 1 |`, async () =>
            await runTest({
                textWithPipe: "if 1 |",
                expected: [KeywordKind.Then],
            }));

        it(`if 1 t|`, async () =>
            await runTest({
                textWithPipe: "if 1 t|",
                expected: [KeywordKind.Then],
            }));

        it(`if 1 then |`, async () =>
            await runTest({
                textWithPipe: "if 1 then |",
                expected: ExpressionKeywordKinds,
            }));

        it(`if 1 then 1|`, async () =>
            await runTest({
                textWithPipe: "if 1 then 1|",
                expected: [],
            }));

        it(`if 1 then 1 e|`, async () =>
            await runTest({
                textWithPipe: "if 1 then 1 e|",
                expected: [KeywordKind.Else],
            }));

        it(`if 1 then 1 else|`, async () =>
            await runTest({
                textWithPipe: "if 1 then 1 else|",
                expected: [],
            }));

        it(`if 1 th|en 1 else`, async () =>
            await runTest({
                textWithPipe: "if 1 th|en 1 else",
                expected: [KeywordKind.Then],
            }));

        it(`if 1 then 1 else |`, async () =>
            await runTest({
                textWithPipe: "if 1 then 1 else |",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, async () =>
            await runTest({
                textWithPipe: `foo(|`,
                expected: ExpressionKeywordKinds,
            }));

        it(`foo(a|`, async () =>
            await runTest({
                textWithPipe: "foo(a|",
                expected: [],
            }));

        it(`foo(a|,`, async () =>
            await runTest({
                textWithPipe: "foo(a|,",
                expected: [],
            }));

        it(`foo(a,|`, async () =>
            await runTest({
                textWithPipe: "foo(a,|",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, async () =>
            await runTest({
                textWithPipe: "{|",
                expected: ExpressionKeywordKinds,
            }));

        it(`{1|`, async () =>
            await runTest({
                textWithPipe: "{1|",
                expected: [],
            }));

        it(`{1|,`, async () =>
            await runTest({
                textWithPipe: "{1|,",
                expected: [],
            }));

        it(`{1,|`, async () =>
            await runTest({
                textWithPipe: "{1,|",
                expected: ExpressionKeywordKinds,
            }));

        it(`{1,|2`, async () =>
            await runTest({
                textWithPipe: "{1,|2",
                expected: ExpressionKeywordKinds,
            }));

        it(`{1,|2,`, async () =>
            await runTest({
                textWithPipe: "{1,|2,",
                expected: ExpressionKeywordKinds,
            }));

        it(`{1..|`, async () =>
            await runTest({
                textWithPipe: "{1..|",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, async () =>
            await runTest({
                textWithPipe: "try true otherwise| false",
                expected: [],
            }));

        it(`try true otherwise |false`, async () =>
            await runTest({
                textWithPipe: "try true otherwise |false",
                expected: ExpressionKeywordKinds,
            }));

        it(`try true oth|`, async () =>
            await runTest({
                textWithPipe: "try true oth|",
                expected: [KeywordKind.Otherwise],
            }));

        it(`try true otherwise |`, async () =>
            await runTest({
                textWithPipe: "try true otherwise |",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, async () =>
            await runTest({
                textWithPipe: "+(|",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, async () =>
            await runTest({
                textWithPipe: "+[|",
                expected: [],
            }));

        it(`+[a=|`, async () =>
            await runTest({
                textWithPipe: "+[a=|",
                expected: ExpressionKeywordKinds,
            }));

        it(`+[a=1|`, async () =>
            await runTest({
                textWithPipe: "+[a=1|",
                expected: [],
            }));

        it(`+[a|=1`, async () =>
            await runTest({
                textWithPipe: "+[a|=1",
                expected: [],
            }));

        it(`+[a=1|]`, async () =>
            await runTest({
                textWithPipe: "+[a=1|]",
                expected: [],
            }));

        it(`+[a=|1]`, async () =>
            await runTest({
                textWithPipe: "+[a=|1]",
                expected: ExpressionKeywordKinds,
            }));

        it(`+[a=1|,`, async () =>
            await runTest({
                textWithPipe: "+[a=1|,",
                expected: [],
            }));

        it(`+[a=1,|`, async () =>
            await runTest({
                textWithPipe: "+[a=1,|",
                expected: [],
            }));

        it(`+[a=1|,b`, async () =>
            await runTest({
                textWithPipe: "+[a=1|,b",
                expected: [],
            }));

        it(`+[a=1|,b=`, async () =>
            await runTest({
                textWithPipe: "+[a=1|,b=",
                expected: [],
            }));

        it(`+[a=|1,b=`, async () =>
            await runTest({
                textWithPipe: "+[a=|1,b=",
                expected: ExpressionKeywordKinds,
            }));

        it(`+[a=1,b=2|`, async () =>
            await runTest({
                textWithPipe: "+[a=1,b=2|",
                expected: [],
            }));

        it(`+[a=1,b=2 |`, async () =>
            await runTest({
                textWithPipe: "+[a=1,b=2 |",
                expected: [],
            }));
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, async () =>
            await runTest({
                textWithPipe: "error |",
                expected: ExpressionKeywordKinds,
            }));

        it(`let x = |`, async () =>
            await runTest({
                textWithPipe: "let x = |",
                expected: ExpressionKeywordKinds,
            }));

        it(`() => |`, async () =>
            await runTest({
                textWithPipe: "() => |",
                expected: ExpressionKeywordKinds,
            }));

        it(`if |`, async () =>
            await runTest({
                textWithPipe: "if |",
                expected: ExpressionKeywordKinds,
            }));

        it(`if true then |`, async () =>
            await runTest({
                textWithPipe: "if true then |",
                expected: ExpressionKeywordKinds,
            }));

        it(`if true then true else |`, async () =>
            await runTest({
                textWithPipe: "if true then true else |",
                expected: ExpressionKeywordKinds,
            }));

        it(`foo(|`, async () =>
            await runTest({
                textWithPipe: "foo(|",
                expected: ExpressionKeywordKinds,
            }));

        it(`let x = 1 in |`, async () =>
            await runTest({
                textWithPipe: "let x = 1 in |",
                expected: ExpressionKeywordKinds,
            }));

        it(`+{|`, async () =>
            await runTest({
                textWithPipe: "+{|",
                expected: ExpressionKeywordKinds,
            }));

        it(`try true otherwise |`, async () =>
            await runTest({
                textWithPipe: "try true otherwise |",
                expected: ExpressionKeywordKinds,
            }));

        it(`+(|`, async () =>
            await runTest({
                textWithPipe: "+(|",
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, async () =>
            await runTest({
                textWithPipe: "section; [] |",
                expected: [KeywordKind.Shared],
            }));

        it(`section; [] x |`, async () =>
            await runTest({
                textWithPipe: "section; [] x |",
                expected: [],
            }));

        it(`section; x = |`, async () =>
            await runTest({
                textWithPipe: "section; x = |",
                expected: ExpressionKeywordKinds,
            }));

        it(`section; x = 1 |`, async () =>
            await runTest({
                textWithPipe: "section; x = 1 |",
                expected: [KeywordKind.And, KeywordKind.As, KeywordKind.Is, KeywordKind.Meta, KeywordKind.Or],
            }));

        it(`section; x = 1 i|`, async () =>
            await runTest({
                textWithPipe: "section; x = 1 i|",
                expected: [KeywordKind.Is],
            }));

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, async () =>
            await runTest({
                textWithPipe: `section foo; a = () => true; b = "string"; c = 1; d = |;`,
                expected: ExpressionKeywordKinds,
            }));
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, async () =>
            await runTest({
                textWithPipe: `let a = |`,
                expected: ExpressionKeywordKinds,
            }));

        it(`let a = 1|`, async () =>
            await runTest({
                textWithPipe: `let a = 1|`,
                expected: [],
            }));

        it(`let a = 1 |`, async () =>
            await runTest({
                textWithPipe: `let a = 1 |`,
                expected: [
                    KeywordKind.And,
                    KeywordKind.As,
                    KeywordKind.Is,
                    KeywordKind.Meta,
                    KeywordKind.Or,
                    KeywordKind.In,
                ],
            }));

        it(`let a = 1 | foobar`, async () =>
            await runTest({
                textWithPipe: `let a = 1 | foobar`,
                expected: [
                    KeywordKind.And,
                    KeywordKind.As,
                    KeywordKind.Is,
                    KeywordKind.Meta,
                    KeywordKind.Or,
                    KeywordKind.In,
                ],
            }));

        it(`let a = 1 i|`, async () =>
            await runTest({
                textWithPipe: `let a = 1 i|`,
                expected: [KeywordKind.Is, KeywordKind.In],
            }));

        it(`let a = 1 o|`, async () =>
            await runTest({
                textWithPipe: `let a = 1 o|`,
                expected: [KeywordKind.Or],
            }));

        it(`let a = 1 m|`, async () =>
            await runTest({
                textWithPipe: `let a = 1 m|`,
                expected: [KeywordKind.Meta],
            }));

        it(`let a = 1, |`, async () =>
            await runTest({
                textWithPipe: `let a = 1, |`,
                expected: [],
            }));

        it(`let a = let b = |`, async () =>
            await runTest({
                textWithPipe: `let a = let b = |`,
                expected: ExpressionKeywordKinds,
            }));

        it(`let a = let b = 1 |`, async () =>
            await runTest({
                textWithPipe: `let a = let b = 1 |`,
                expected: [
                    KeywordKind.And,
                    KeywordKind.As,
                    KeywordKind.Is,
                    KeywordKind.Meta,
                    KeywordKind.Or,
                    KeywordKind.In,
                ],
            }));

        it(`let a = let b = 1, |`, async () =>
            await runTest({
                textWithPipe: `let a = let b = 1, |`,
                expected: [],
            }));

        it(`let x = e|`, async () =>
            await runTest({
                textWithPipe: `let x = e|`,
                expected: [KeywordKind.Each, KeywordKind.Error],
            }));

        it(`let x = error let x = e|`, async () =>
            await runTest({
                textWithPipe: `let x = error let x = e|`,
                expected: [KeywordKind.Each, KeywordKind.Error],
            }));
    });
});
