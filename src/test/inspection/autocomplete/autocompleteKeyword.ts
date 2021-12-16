// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "@microsoft/powerquery-parser";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import "mocha";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

function assertGetKeywordAutocomplete(text: string, position: Position): ReadonlyArray<Inspection.AutocompleteItem> {
    const actual: Inspection.Autocomplete = TestUtils.assertGetAutocomplete(
        TestConstants.DefaultInspectionSettings,
        text,
        position,
    );
    Assert.isOk(actual.triedKeyword);
    return actual.triedKeyword.value;
}

describe(`Inspection - Autocomplete - Keyword`, () => {
    it("|", () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|`);
        const expected: ReadonlyArray<Keyword.KeywordKind> = [
            ...Keyword.ExpressionKeywordKinds,
            Keyword.KeywordKind.Section,
        ];
        const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    describe("partial keyword", () => {
        it("a|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`a|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("x a|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`x a|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.And, Keyword.KeywordKind.As];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("e|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Each, Keyword.KeywordKind.Error];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("if x then x e|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if x then x e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Else];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("i|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`i|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.If];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("l|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`l|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Let];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("m|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`m|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("x m|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`x m|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Meta];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("n|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`n|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Not];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("true o|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`true o|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Or];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true o|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true o|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.Otherwise,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true o |", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true o |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true ot|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true ot|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true oth|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("s|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Section];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] |", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Section];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] |s", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] |s`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] s|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Section];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] s |", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] s |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("section; s|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Shared];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("section; shared x|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; shared x|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("section; [] s|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; [] s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Shared];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("if true t|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if true t|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("t|", () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`t|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.True,
                Keyword.KeywordKind.Try,
                Keyword.KeywordKind.Type,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.True];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.Otherwise,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |error`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if error|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if error|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`error |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`error |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = (_ |) => a in x`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.As];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = (_ a|) => a in`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = (_ a|) => a in`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.As];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(` if |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if |if`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |if`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if i|f`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if i|f`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.If];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if if | `, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if if |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 t|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 t|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1 e|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1 e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Else];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1 else|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1 else|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 th|en 1 else`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 th|en 1 else`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1 else |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1 else |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(a|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(a|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(a|,`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(a|,`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(a,|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(a,|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1|,`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1|,`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1,|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1,|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1,|2`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1,|2`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1,|2,`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1,|2,`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1..|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1..|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`try true otherwise| false`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true otherwise |false`, () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`try true otherwise |false`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true oth|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Otherwise];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a|=1`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a|=1`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|]`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|]`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=|1]`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=| 1]`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|,`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1,|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1,|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|,b`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|,b`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|,b=`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|,b=`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=|1,b=`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=|1,b=`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1,b=2|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1,b=2|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1,b=2 |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1,b=2 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`error |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`() => |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`() => |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if true then |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if true then |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if true then true else |`, () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`if true then true else |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = 1 in |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = 1 in |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+{|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+{|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true otherwise |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+(|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; [] |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Shared];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; [] x |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; [] x |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; x = |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; x = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; x = 1 |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; x = 1 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; x = 1 i|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; x = 1 i|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Is];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
            );
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.In,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 | foobar`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 | foobar`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.In,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 i|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 i|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Is, Keyword.KeywordKind.In];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 o|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 o|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Or];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 m|`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 m|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Meta];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1, |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1, |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = let b = |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = let b = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = let b = 1 |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = let b = 1 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.In,
            ];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = let b = 1, |`, () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = let b = 1, |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];
            const actual: ReadonlyArray<Inspection.AutocompleteItem> = assertGetKeywordAutocomplete(text, position);
            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });
});
