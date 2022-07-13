// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Ast, Keyword } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { TestConstants, TestUtils } from "../..";
import { Inspection } from "../../../powerquery-language-services";

async function assertGetKeywordAutocomplete(
    text: string,
    position: Position,
): Promise<ReadonlyArray<Inspection.AutocompleteItem>> {
    const actual: Inspection.Autocomplete = await TestUtils.assertGetAutocomplete(
        TestConstants.DefaultInspectionSettings,
        text,
        position,
    );

    Assert.isOk(actual.triedKeyword);

    return actual.triedKeyword.value;
}

describe(`Inspection - Autocomplete - Keyword`, () => {
    it("|", async () => {
        const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|`);

        const expected: ReadonlyArray<Keyword.KeywordKind> = [
            ...Keyword.ExpressionKeywordKinds,
            Keyword.KeywordKind.Section,
        ];

        const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(text, position);
        TestUtils.assertAutocompleteItemLabels(expected, actual);
    });

    describe("partial keyword", () => {
        it("a|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`a|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("x a|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`x a|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.And, Keyword.KeywordKind.As];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("e|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Each, Keyword.KeywordKind.Error];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("if x then x e|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if x then x e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Else];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("i|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`i|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.If];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("l|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`l|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Let];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("m|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`m|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("x m|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`x m|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Meta];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("n|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`n|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Not];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("true o|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`true o|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Or];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true o|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true o|`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.Otherwise,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true o |", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true o |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true ot|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true ot|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Otherwise];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("try true oth|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Otherwise];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("s|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Section];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] |", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Section];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] |s", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] |s`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] s|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Section];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("[] s |", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[] s |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("section; s|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Shared];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("section; shared x|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; shared x|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("section; [] s|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; [] s|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Shared];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("if true t|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if true t|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it("t|", async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`t|`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.True,
                Keyword.KeywordKind.Try,
                Keyword.KeywordKind.Type,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.True];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true |`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.Otherwise,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
        it(`if |error`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |error`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if error|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if error|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`error |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`error |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`let x = (_ |) => a in x`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = (_ |) => a in x`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.As];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = (_ a|) => a in`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = (_ a|) => a in`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.As];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.IfExpression}`, () => {
        it(`if|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(` if |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if |if`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |if`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if i|f`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if i|f`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.If];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if if | `, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if if |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 t|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 t|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1 e|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1 e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Else];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1 else|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1 else|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 th|en 1 else`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 th|en 1 else`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Then];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if 1 then 1 else |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if 1 then 1 else |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.InvokeExpression}`, () => {
        it(`foo(|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(a|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(a|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(a|,`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(a|,`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(a,|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(a,|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1|,`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1|,`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1,|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1,|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1,|2`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1,|2`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1,|2,`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1,|2,`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`{1..|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`{1..|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.OtherwiseExpression}`, () => {
        it(`try true otherwise| false`, async () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`try true otherwise| false`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true otherwise |false`, async () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`try true otherwise |false`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true oth|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true oth|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Otherwise];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true otherwise |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`+(|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`+[|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a|=1`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a|=1`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|]`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|]`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=|1]`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=| 1]`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|,`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1,|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1,|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|,b`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|,b`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1|,b=`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1|,b=`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=|1,b=`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=|1,b=`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1,b=2|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1,b=2|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+[a=1,b=2 |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+[a=1,b=2 |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`AutocompleteExpression`, () => {
        it(`error |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`error |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`() => |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`() => |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if true then |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`if true then |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`if true then true else |`, async () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`if true then true else |`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`foo(|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`foo(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = 1 in |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = 1 in |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+{|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+{|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`try true otherwise |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`try true otherwise |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`+(|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`+(|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; [] |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; [] |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Shared];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; [] x |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; [] x |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; x = |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; x = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; x = 1 |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; x = 1 |`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section; x = 1 i|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`section; x = 1 i|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Is];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `section foo; a = () => true; b = "string"; c = 1; d = |;`,
            );

            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let a = |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 |`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.In,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 | foobar`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 | foobar`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.In,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 i|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 i|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Is, Keyword.KeywordKind.In];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 o|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 o|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Or];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1 m|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 m|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Meta];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = 1, |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1, |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = let b = |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = let b = |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = Keyword.ExpressionKeywordKinds;

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = let b = 1 |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = let b = 1 |`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [
                Keyword.KeywordKind.And,
                Keyword.KeywordKind.As,
                Keyword.KeywordKind.Is,
                Keyword.KeywordKind.Meta,
                Keyword.KeywordKind.Or,
                Keyword.KeywordKind.In,
            ];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let a = let b = 1, |`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = let b = 1, |`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = e|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let x = e|`);
            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Each, Keyword.KeywordKind.Error];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });

        it(`let x = error let x = e|`, async () => {
            const [text, position]: [string, Position] =
                TestUtils.assertGetTextWithPosition(`let x = error let x = e|`);

            const expected: ReadonlyArray<Keyword.KeywordKind> = [Keyword.KeywordKind.Each, Keyword.KeywordKind.Error];

            const actual: ReadonlyArray<Inspection.AutocompleteItem> = await assertGetKeywordAutocomplete(
                text,
                position,
            );

            TestUtils.assertAutocompleteItemLabels(expected, actual);
        });
    });
});
