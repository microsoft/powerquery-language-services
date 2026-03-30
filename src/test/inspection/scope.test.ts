// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Inspection, InspectionSettings, Library, TypeStrategy } from "../../powerquery-language-services";
import { expect } from "chai";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { ResultKind } from "@microsoft/powerquery-parser";
import { TAbridgedNodeScopeItem } from "../testUtils";
import { Task } from "@microsoft/powerquery-parser/lib/powerquery-parser/task";
import { TestUtils } from "..";

describe(`Inspection - Scope - Identifier`, () => {
    const DefaultSettings: InspectionSettings = {
        ...PQP.DefaultSettings,
        isTypeDirectiveAllowed: false,
        isWorkspaceCacheAllowed: false,
        eachScopeById: undefined,
        library: Library.NoOpLibrary,
        typeStrategy: TypeStrategy.Extended,
    };

    async function runTest(params: {
        readonly textWithPipe: string;
        readonly expected: ReadonlyArray<TAbridgedNodeScopeItem>;
    }): Promise<void> {
        await TestUtils.assertEqualNodeScope({
            textWithPipe: params.textWithPipe,
            expected: params.expected,
            inspectionSettings: DefaultSettings,
        });
    }

    describe(`Scope`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
            it(`|each 1`, async () =>
                await runTest({
                    textWithPipe: `|each 1`,
                    expected: [],
                }));

            it(`each| 1`, async () =>
                await runTest({
                    textWithPipe: `each| 1`,
                    expected: [],
                }));

            it(`each |1`, async () =>
                await runTest({
                    textWithPipe: `each |1`,
                    expected: [
                        {
                            identifier: "_",
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Each,
                            eachExpressionNodeId: 1,
                        },
                    ],
                }));

            it(`each 1|`, async () =>
                await runTest({
                    textWithPipe: `each 1|`,
                    expected: [
                        {
                            identifier: "_",
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Each,
                            eachExpressionNodeId: 1,
                        },
                    ],
                }));

            it(`each each 1|`, async () =>
                await runTest({
                    textWithPipe: `each each 1|`,
                    expected: [
                        {
                            identifier: "_",
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Each,
                            eachExpressionNodeId: 3,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
            it(`each|`, async () =>
                await runTest({
                    textWithPipe: `each|`,
                    expected: [],
                }));

            it(`each |`, async () =>
                await runTest({
                    textWithPipe: `each |`,
                    expected: [
                        {
                            identifier: "_",
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Each,
                            eachExpressionNodeId: 1,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.FieldProjection}`, () => {
            // We shouldn't include scope for field projections
            it(`let person = [name = "john doe", age = 42] in person[ [|`, async () =>
                await runTest({
                    textWithPipe: `let person = [name = "john doe", age = 42] in person[ [|`,
                    expected: [],
                }));
        });

        describe(`${Ast.NodeKind.FieldSelector}`, () => {
            // We shouldn't include scope for field selectors
            it(`let person = [name = "john doe", age = 42] in person[|`, async () =>
                await runTest({
                    textWithPipe: `let person = [name = "john doe", age = 42] in person[|`,
                    expected: [],
                }));
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, async () =>
                await runTest({
                    textWithPipe: `|(x) => z`,
                    expected: [],
                }));

            it(`(x|, y) => z`, async () =>
                await runTest({
                    textWithPipe: `(x|, y) => z`,
                    expected: [],
                }));

            it(`(x, y)| => z`, async () =>
                await runTest({
                    textWithPipe: `(x, y)| => z`,
                    expected: [],
                }));

            it(`(x, y) => z|`, async () =>
                await runTest({
                    textWithPipe: `(x, y) => z|`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, async () =>
                await runTest({
                    textWithPipe: `|(x) =>`,
                    expected: [],
                }));

            it(`(x|, y) =>`, async () =>
                await runTest({
                    textWithPipe: `(x|, y) =>`,
                    expected: [],
                }));

            it(`(x, y)| =>`, async () =>
                await runTest({
                    textWithPipe: `(x, y)| =>`,
                    expected: [],
                }));

            it(`(x, y) =>|`, async () =>
                await runTest({
                    textWithPipe: `(x, y) =>|`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`let x = 1, y = x in 1|`, async () =>
                await runTest({
                    textWithPipe: `let x = 1, y = x in 1|`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[a=1]`, async () =>
                await runTest({
                    textWithPipe: `|[a=1]`,
                    expected: [],
                }));

            it(`[|a=1]`, async () =>
                await runTest({
                    textWithPipe: `[|a=1]`,
                    expected: [],
                }));

            it(`[a=1|]`, async () =>
                await runTest({
                    textWithPipe: `[a=1|]`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                    ],
                }));

            it(`[a=1, b=2|]`, async () =>
                await runTest({
                    textWithPipe: `[a=1, b=2|]`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 17,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 17,
                        },
                    ],
                }));

            it(`[a=1, b=2|, c=3]`, async () =>
                await runTest({
                    textWithPipe: `[a=1, b=2|, c=3]`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 17,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 17,
                        },
                        {
                            identifier: "c",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                        {
                            identifier: "@c",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                        {
                            identifier: `#"c"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                        {
                            identifier: `@#"c"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                    ],
                }));

            it(`[a=1]|`, async () =>
                await runTest({
                    textWithPipe: `[a=1]|`,
                    expected: [],
                }));

            it(`[a=[|b=1]]`, async () =>
                await runTest({
                    textWithPipe: `[a=[|b=1]]`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                    ],
                }));

            it(`[foo = (x as number) => if x > 0 then @|foo(x - 1) else 42, bar = null][foo](10)`, async () =>
                await runTest({
                    textWithPipe: `[foo = (x as number) => if x > 0 then @|foo(x - 1) else 42, bar = null][foo](10)`,
                    expected: [
                        {
                            identifier: "@foo",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"foo"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "bar",
                            isRecursive: false,
                            keyNodeId: 55,
                            kind: Inspection.ScopeItemKind.RecordField,
                            valueNodeId: 58,
                        },
                        {
                            identifier: "@bar",
                            isRecursive: false,
                            keyNodeId: 55,
                            kind: Inspection.ScopeItemKind.RecordField,
                            valueNodeId: 58,
                        },
                        {
                            identifier: `#"bar"`,
                            isRecursive: false,
                            keyNodeId: 55,
                            kind: Inspection.ScopeItemKind.RecordField,
                            valueNodeId: 58,
                        },
                        {
                            identifier: `@#"bar"`,
                            isRecursive: false,
                            keyNodeId: 55,
                            kind: Inspection.ScopeItemKind.RecordField,
                            valueNodeId: 58,
                        },
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: false,
                            isOptional: false,
                            type: Constant.PrimitiveTypeConstant.Number,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: false,
                            isOptional: false,
                            type: Constant.PrimitiveTypeConstant.Number,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[a=1`, async () =>
                await runTest({
                    textWithPipe: `|[a=1`,
                    expected: [],
                }));

            it(`[|a=1`, async () =>
                await runTest({
                    textWithPipe: `[|a=1`,
                    expected: [],
                }));

            it(`[a=|1`, async () =>
                await runTest({
                    textWithPipe: `[a=|1`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                    ],
                }));

            it(`[a=1|`, async () =>
                await runTest({
                    textWithPipe: `[a=1|`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                    ],
                }));

            it(`[a=1, b=|`, async () =>
                await runTest({
                    textWithPipe: `[a=1, b=|`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 16,
                        },
                    ],
                }));

            it(`[a=1, b=2|, c=3`, async () =>
                await runTest({
                    textWithPipe: `[a=1, b=2|, c=3`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 7,
                            valueNodeId: 10,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 17,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 14,
                            valueNodeId: 17,
                        },
                        {
                            identifier: "c",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                        {
                            identifier: "@c",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                        {
                            identifier: `#"c"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                        {
                            identifier: `@#"c"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: false,
                            keyNodeId: 21,
                            valueNodeId: 24,
                        },
                    ],
                }));

            it(`[a=[|b=1`, async () =>
                await runTest({
                    textWithPipe: `[a=[|b=1`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 9,
                        },
                    ],
                }));

            it(`[a=[b=|`, async () =>
                await runTest({
                    textWithPipe: `[a=[b=|`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 7,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 17,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.RecordField,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 17,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.Section} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, async () =>
                await runTest({
                    textWithPipe: `s|ection foo; x = 1; y = 2;`,
                    expected: [],
                }));

            it(`section foo; x = 1|; y = 2;`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1|; y = 2;`,
                    expected: [
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                    ],
                }));

            it(`section foo; x = 1; y = 2|;`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1; y = 2|;`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                    ],
                }));

            it(`section foo; x = 1; y = 2;|`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1; y = 2;|`,
                    expected: [],
                }));

            it(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1; y = 2; z = let a = 1 in |b;`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: "@z",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 22,
                            valueNodeId: 24,
                        },
                        {
                            identifier: `@#"z"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 22,
                            valueNodeId: 24,
                        },
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 29,
                            valueNodeId: 32,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 29,
                            valueNodeId: 32,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 29,
                            valueNodeId: 32,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 29,
                            valueNodeId: 32,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            it(`s|ection foo; x = 1; y = 2`, async () =>
                await runTest({
                    textWithPipe: `s|ection foo; x = 1; y = 2`,
                    expected: [],
                }));

            it(`section foo; x = 1|; y = 2`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1|; y = 2`,
                    expected: [
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                    ],
                }));

            it(`section foo; x = 1; y = 2|`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1; y = 2|`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 18,
                        },
                    ],
                }));

            it(`section foo; x = 1; y = () => 10|`, async () =>
                await runTest({
                    textWithPipe: `section foo; x = 1; y = () => 10|`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: false,
                            keyNodeId: 8,
                            valueNodeId: 11,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 17,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.SectionMember,
                            isRecursive: true,
                            keyNodeId: 15,
                            valueNodeId: 17,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1 in |x`, async () =>
                await runTest({
                    textWithPipe: `let a = 1 in |x`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                    ],
                }));

            it(`let a = 1 in x|`, async () =>
                await runTest({
                    textWithPipe: `let a = 1 in x|`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                    ],
                }));

            it(`let a = |1 in x`, async () =>
                await runTest({
                    textWithPipe: `let a = |1 in x`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                    ],
                }));

            it(`let a = 1, b = 2 in x|`, async () =>
                await runTest({
                    textWithPipe: `let a = 1, b = 2 in x|`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                    ],
                }));

            it(`let a = 1|, b = 2 in x`, async () =>
                await runTest({
                    textWithPipe: `let a = 1|, b = 2 in x`,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                    ],
                }));

            it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, async () =>
                await runTest({
                    textWithPipe: `(p1, p2) => let a = 1, b = 2, c = 3| in c`,
                    expected: [
                        {
                            identifier: "p1",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: `#"p1"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: "p2",
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: `#"p2"`,
                            kind: Inspection.ScopeItemKind.Parameter,
                            isRecursive: false,
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 19,
                            valueNodeId: 22,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 19,
                            valueNodeId: 22,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 19,
                            valueNodeId: 22,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 19,
                            valueNodeId: 22,
                        },
                        {
                            identifier: "b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 26,
                            valueNodeId: 29,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 26,
                            valueNodeId: 29,
                        },
                        {
                            identifier: `#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 26,
                            valueNodeId: 29,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 26,
                            valueNodeId: 29,
                        },
                        {
                            identifier: "@c",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 33,
                            valueNodeId: 36,
                        },
                        {
                            identifier: `@#"c"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 33,
                            valueNodeId: 36,
                        },
                    ],
                }));

            it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, async () =>
                await runTest({
                    textWithPipe: `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
                    expected: [
                        {
                            identifier: "eggs",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 8,
                        },
                        {
                            identifier: "@eggs",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 8,
                        },
                        {
                            identifier: `#"eggs"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 8,
                        },
                        {
                            identifier: `@#"eggs"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 8,
                        },
                        {
                            identifier: "foo",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: "@foo",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: `#"foo"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: `@#"foo"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: "bar",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: "@bar",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: `#"bar"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: `@#"bar"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                    ],
                }));

            it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, async () =>
                await runTest({
                    textWithPipe: `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
                    expected: [
                        {
                            identifier: "@eggs",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 8,
                        },
                        {
                            identifier: `@#"eggs"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 8,
                        },
                        {
                            identifier: "foo",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: "@foo",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: `#"foo"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: `@#"foo"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 23,
                            valueNodeId: 26,
                        },
                        {
                            identifier: "bar",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: "@bar",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: `#"bar"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: `@#"bar"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 30,
                            valueNodeId: 33,
                        },
                        {
                            identifier: "ham",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: "@ham",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `#"ham"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"ham"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                    ],
                }));

            it(`let foo = (x as number) => if x > 0 then @|foo(x - 1) else 42, bar = null in 1`, async () =>
                await runTest({
                    textWithPipe: `let foo = (x as number) => if x > 0 then @|foo(x - 1) else 42, bar = null in 1`,
                    expected: [
                        {
                            identifier: "bar",
                            isRecursive: false,
                            keyNodeId: 54,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 57,
                        },
                        {
                            identifier: "@bar",
                            isRecursive: false,
                            keyNodeId: 54,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 57,
                        },
                        {
                            identifier: '#"bar"',
                            isRecursive: false,
                            keyNodeId: 54,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 57,
                        },
                        {
                            identifier: '@#"bar"',
                            isRecursive: false,
                            keyNodeId: 54,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 57,
                        },
                        {
                            identifier: "@foo",
                            isRecursive: true,
                            keyNodeId: 6,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 8,
                        },
                        {
                            identifier: '@#"foo"',
                            isRecursive: true,
                            keyNodeId: 6,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 8,
                        },
                        {
                            identifier: "x",
                            isNullable: false,
                            isOptional: false,
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Parameter,
                            type: Constant.PrimitiveTypeConstant.Number,
                        },
                        {
                            identifier: '#"x"',
                            isNullable: false,
                            isOptional: false,
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Parameter,
                            type: Constant.PrimitiveTypeConstant.Number,
                        },
                    ],
                }));
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1 in |`, async () =>
                await runTest({
                    textWithPipe: `let a = 1 in |`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                    ],
                }));

            it(`let a = 1, b = 2 in |`, async () =>
                await runTest({
                    textWithPipe: `let a = 1, b = 2 in |`,
                    expected: [
                        {
                            identifier: "a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                    ],
                }));

            it(`let a = 1|, b = 2 in`, async () =>
                await runTest({
                    textWithPipe: `let a = 1|, b = 2 in `,
                    expected: [
                        {
                            identifier: "@a",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"a"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: "@b",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                        {
                            identifier: `@#"b"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 13,
                            valueNodeId: 16,
                        },
                    ],
                }));

            it(`let x = (let y = 1 in z|) in`, async () =>
                await runTest({
                    textWithPipe: `let x = (let y = 1 in z|) in`,
                    expected: [
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: true,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "y",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 16,
                            valueNodeId: 19,
                        },
                        {
                            identifier: "@y",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 16,
                            valueNodeId: 19,
                        },
                        {
                            identifier: `#"y"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 16,
                            valueNodeId: 19,
                        },
                        {
                            identifier: `@#"y"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 16,
                            valueNodeId: 19,
                        },
                    ],
                }));

            it(`let x = (let y = 1 in z) in |`, async () =>
                await runTest({
                    textWithPipe: `let x = (let y = 1 in z) in |`,
                    expected: [
                        {
                            identifier: "x",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: "@x",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },

                        {
                            identifier: `#"x"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@#"x"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 9,
                        },
                    ],
                }));

            it(`an EachExpression contains the parent's scope`, async () =>
                await runTest({
                    textWithPipe: `let
                        tbl = 1 as table,
                        bar = "bar"
                    in
                        each |`,
                    expected: [
                        {
                            identifier: "tbl",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 13,
                        },
                        {
                            identifier: "@tbl",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 13,
                        },
                        {
                            identifier: `#"tbl"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 13,
                        },
                        {
                            identifier: `@#"tbl"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 6,
                            valueNodeId: 13,
                        },
                        {
                            identifier: "bar",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 17,
                            valueNodeId: 20,
                        },
                        {
                            identifier: "@bar",
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 17,
                            valueNodeId: 20,
                        },
                        {
                            identifier: `#"bar"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 17,
                            valueNodeId: 20,
                        },

                        {
                            identifier: `@#"bar"`,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            isRecursive: false,
                            keyNodeId: 17,
                            valueNodeId: 20,
                        },
                        {
                            eachExpressionNodeId: 22,
                            identifier: "_",
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Each,
                        },
                    ],
                }));
        });

        describe(`generalized expression`, () => {
            it(`let #"x" = 1 in x`, async () =>
                await runTest({
                    textWithPipe: `let #"x" = 1 in x|`,
                    expected: [
                        {
                            identifier: `x`,
                            isRecursive: false,
                            keyNodeId: 6,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `@x`,
                            isRecursive: false,
                            keyNodeId: 6,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 9,
                        },
                        {
                            identifier: `#"x"`,
                            isRecursive: false,
                            keyNodeId: 6,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 9,
                        },

                        {
                            identifier: `@#"x"`,
                            isRecursive: false,
                            keyNodeId: 6,
                            kind: Inspection.ScopeItemKind.LetVariable,
                            valueNodeId: 9,
                        },
                    ],
                }));
        });
    });

    describe(`Parameter`, () => {
        it(`(a, b as number, c as nullable function, optional d, optional e as table) => 1|`, async () =>
            await runTest({
                textWithPipe: `(a, b as number, c as nullable function, optional d, optional e as table) => 1|`,
                expected: [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: true,
                        isOptional: false,
                        type: undefined,
                    },
                    {
                        identifier: `#"a"`,
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: true,
                        isOptional: false,
                        type: undefined,
                    },
                    {
                        identifier: "b",
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: false,
                        isOptional: false,
                        type: Constant.PrimitiveTypeConstant.Number,
                    },
                    {
                        identifier: `#"b"`,
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: false,
                        isOptional: false,
                        type: Constant.PrimitiveTypeConstant.Number,
                    },
                    {
                        identifier: "c",
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: true,
                        isOptional: false,
                        type: Constant.PrimitiveTypeConstant.Function,
                    },
                    {
                        identifier: `#"c"`,
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: true,
                        isOptional: false,
                        type: Constant.PrimitiveTypeConstant.Function,
                    },
                    {
                        identifier: "d",
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: true,
                        isOptional: true,
                        type: undefined,
                    },
                    {
                        identifier: `#"d"`,
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: true,
                        isOptional: true,
                        type: undefined,
                    },
                    {
                        identifier: "e",
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: false,
                        isOptional: true,
                        type: Constant.PrimitiveTypeConstant.Table,
                    },
                    {
                        identifier: `#"e"`,
                        kind: Inspection.ScopeItemKind.Parameter,
                        isRecursive: false,
                        isNullable: false,
                        isOptional: true,
                        type: Constant.PrimitiveTypeConstant.Table,
                    },
                ],
            }));
    });

    describe("Cache and scaling", () => {
        async function parseText(text: string): Promise<NodeIdMap.Collection> {
            const triedLexParse: Task.TriedLexParseTask = await PQP.TaskUtils.tryLexParse(
                { ...PQP.DefaultSettings, traceManager: NoOpTraceManagerInstance },
                text,
            );

            if (triedLexParse.resultKind !== ResultKind.Ok) {
                throw new Error("Parse failed");
            }

            return triedLexParse.nodeIdMapCollection;
        }

        function getValueIdentifiers(nodeIdMapCollection: NodeIdMap.Collection): Ast.Identifier[] {
            const identifierIds: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
                Ast.NodeKind.Identifier,
            );

            if (!identifierIds) {
                return [];
            }

            const result: Ast.Identifier[] = [];

            for (const id of identifierIds.values()) {
                const node: Ast.Identifier | undefined = nodeIdMapCollection.astNodeById.get(id) as
                    | Ast.Identifier
                    | undefined;

                if (node?.identifierContextKind === Ast.IdentifierContextKind.Value) {
                    result.push(node);
                }
            }

            return result;
        }

        async function buildAllScopes(text: string): Promise<{
            readonly scopeById: Inspection.ScopeById;
            readonly identifiers: Ast.Identifier[];
            readonly nodeIdMapCollection: NodeIdMap.Collection;
        }> {
            const nodeIdMapCollection: NodeIdMap.Collection = await parseText(text);
            const identifiers: Ast.Identifier[] = getValueIdentifiers(nodeIdMapCollection);
            const scopeById: Inspection.ScopeById = new Map();

            for (const identifier of identifiers) {
                // eslint-disable-next-line no-await-in-loop
                await Inspection.tryNodeScope(
                    DefaultSettings,
                    nodeIdMapCollection,
                    undefined,
                    identifier.id,
                    scopeById,
                );
            }

            return { scopeById, identifiers, nodeIdMapCollection };
        }

        it("repeated tryNodeScope calls reuse cached scopes", async () => {
            const text: string = `let a = 1, b = 2, c = 3, d = 4, e = 5 in a + b + c + d + e`;

            const result: {
                readonly scopeById: Inspection.ScopeById;
                readonly identifiers: Ast.Identifier[];
                readonly nodeIdMapCollection: NodeIdMap.Collection;
            } = await buildAllScopes(text);

            const scopeCountAfterFirstPass: number = result.scopeById.size;

            for (const identifier of result.identifiers) {
                // eslint-disable-next-line no-await-in-loop
                await Inspection.tryNodeScope(
                    DefaultSettings,
                    result.nodeIdMapCollection,
                    undefined,
                    identifier.id,
                    result.scopeById,
                );
            }

            expect(result.scopeById.size).to.equal(scopeCountAfterFirstPass);
        });

        it("scope computation scales sub-cubically for large let expressions", async () => {
            function generateLet(n: number): string {
                const bindings: string[] = [];

                for (let i: number = 0; i < n; i += 1) {
                    bindings.push(`v${i} = ${i}`);
                }

                return `let ${bindings.join(", ")} in v0`;
            }

            const smallText: string = generateLet(20);
            const largeText: string = generateLet(80);

            async function timeScope(text: string): Promise<number> {
                const start: number = Date.now();
                await buildAllScopes(text);

                return Date.now() - start;
            }

            const smallTime: number = await timeScope(smallText);
            const largeTime: number = await timeScope(largeText);

            // With 4x more bindings, pure O(n³) would give 64x slowdown.
            // With the cached approach, expect much less.
            // Use a generous threshold of 20x to avoid flaky tests.
            const ratio: number = largeTime / Math.max(smallTime, 0.001);

            expect(ratio).to.be.lessThan(20, `Expected sub-cubic scaling but got ${ratio.toFixed(1)}x for 4x input`);
        });
    });
});
