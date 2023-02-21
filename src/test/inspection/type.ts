// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import type { Position } from "vscode-languageserver-types";

import { ExternalType, Inspection, InspectionSettings, TypeStrategy } from "../../powerquery-language-services";
import { TestUtils } from "..";

const ExternalTypeResolver: ExternalType.TExternalTypeResolverFn = (request: ExternalType.TExternalTypeRequest) => {
    switch (request.kind) {
        case ExternalType.ExternalTypeRequestKind.Invocation: {
            if (request.identifierLiteral !== "foo") {
                return undefined;
            }

            return request.args.length === 0 ? Type.TextInstance : Type.NumberInstance;
        }

        case ExternalType.ExternalTypeRequestKind.Value:
            return request.identifierLiteral === "foo" ? Type.FunctionInstance : undefined;

        default:
            throw Assert.isNever(request);
    }
};

const ExtendedTestSettings: InspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: false,
    library: {
        externalTypeResolver: ExternalTypeResolver,
        libraryDefinitions: new Map(),
    },
    eachScopeById: undefined,
    typeStrategy: TypeStrategy.Extended,
};

const PrimitiveTestSettings: InspectionSettings = {
    ...ExtendedTestSettings,
    typeStrategy: TypeStrategy.Primitive,
};

async function assertParseOkNodeTypeEqual(
    settings: InspectionSettings,
    text: string,
    expected: Type.TPowerQueryType,
): Promise<void> {
    const parseOk: PQP.Task.ParseTaskOk = await TestUtils.assertGetLexParseOk(ExtendedTestSettings, text);

    const actual: Type.TPowerQueryType = await assertGetParseNodeOk(
        settings,
        parseOk.nodeIdMapCollection,
        XorNodeUtils.boxAst(parseOk.ast),
    );

    expect(actual).deep.equal(expected);
}

async function assertParseErrNodeTypeEqual(text: string, expected: Type.TPowerQueryType): Promise<void> {
    const parseError: PQP.Task.ParseTaskParseError = await TestUtils.assertGetLexParseError(ExtendedTestSettings, text);

    const actual: Type.TPowerQueryType = await assertGetParseNodeOk(
        ExtendedTestSettings,
        parseError.nodeIdMapCollection,
        XorNodeUtils.boxContext(Assert.asDefined(parseError.parseState.contextState.root)),
    );

    expect(actual).deep.equal(expected);
}

async function assertGetParseNodeOk(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
): Promise<Type.TPowerQueryType> {
    const triedType: Inspection.TriedType = await Inspection.tryType(settings, nodeIdMapCollection, xorNode.node.id);
    Assert.isOk(triedType);

    return triedType.value;
}

async function assertParseOkScopeTypeEqual(
    settings: InspectionSettings,
    textWithPipe: string,
    expected: Inspection.ScopeTypeByKey,
): Promise<void> {
    const [textWithoutPipe, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPipe);
    const parseOk: PQP.Task.ParseTaskOk = await TestUtils.assertGetLexParseOk(ExtendedTestSettings, textWithoutPipe);

    const actual: Inspection.ScopeTypeByKey = await assertGetParseOkScopeTypeOk(
        settings,
        parseOk.nodeIdMapCollection,
        position,
    );

    expect(actual).deep.equal(expected);
}

async function assertGetParseOkScopeTypeOk(
    settings: InspectionSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
): Promise<Inspection.ScopeTypeByKey> {
    const activeNodeLeaf: TXorNode = Inspection.ActiveNodeUtils.assertGetLeaf(
        Inspection.ActiveNodeUtils.assertActiveNode(nodeIdMapCollection, position),
    );

    const triedScopeType: Inspection.TriedScopeType = await Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        activeNodeLeaf.node.id,
    );

    Assert.isOk(triedScopeType);

    return triedScopeType.value;
}

const noopTraceCreateAnyUnion: (unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType = (
    unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.createAnyUnion(unionedTypePairs, NoOpTraceManagerInstance, undefined);

describe(`Inspection - Type`, () => {
    describe(`extended static analysis`, () => {
        describe("BinOpExpression", () => {
            it(`1 + 1`, async () => {
                const expression: string = "1 + 1";
                const expected: Type.Number = Type.NumberInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`true and false`, async () => {
                const expression: string = `true and false`;
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`"hello" & "world"`, async () => {
                const expression: string = `"hello" & "world"`;
                const expected: Type.Text = Type.TextInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`true + 1`, async () => {
                const expression: string = `true + 1`;
                const expected: Type.None = Type.NoneInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
            it(`(foo as number, bar as nullable number) => foo + bar|`, async () => {
                const expression: string = `(foo as number, bar as nullable number) => foo + bar|`;

                const expected: Inspection.ScopeTypeByKey = new Map([
                    ["foo", Type.NumberInstance],
                    ["bar", Type.NullableNumberInstance],
                ]);

                await assertParseOkScopeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.AsExpression}`, () => {
            it(`1 as number`, async () => {
                const expression: string = `1 as number`;
                const expected: Type.Number = Type.NumberInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`1 as text`, async () => {
                const expression: string = `1 as text`;
                const expected: Type.Text = Type.TextInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`1 as any`, async () => {
                const expression: string = `1 as any`;
                const expected: Type.Any = Type.AnyInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.EachExpression}`, () => {
            // Test for when EachExpression returns a static value
            it(`each 1`, async () => {
                const expression: string = `each 1`;

                const expected: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: false,
                            type: Type.TypeKind.Any,
                            nameLiteral: "_",
                        },
                    ],
                    TypeUtils.createNumberLiteral(false, "1"),
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try 1`, async () => {
                const expression: string = `try 1`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Record),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`try 1 otherwise false`, async () => {
                const expression: string = `try 1 otherwise false`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`try 1 otherwise`, async () => {
                const expression: string = `try 1 otherwise`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    Type.UnknownInstance,
                    TypeUtils.createNumberLiteral(false, "1"),
                ]);

                await assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`try true catch () => 1)`, async () => {
                const expression: string = `try true catch () => 1`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`try true catch`, async () => {
                const expression: string = `try true catch`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical),
                    Type.UnknownInstance,
                ]);

                await assertParseErrNodeTypeEqual(expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error 1`, async () => {
                const expression: string = `error 1`;
                const expected: Type.Any = Type.AnyInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FieldProjection}`, () => {
            it(`[a = 1][[a]]`, async () => {
                const expression: string = `[a = 1][[a]]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["a", TypeUtils.createNumberLiteral(false, "1")]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[a = 1][[b]]`, async () => {
                const expression: string = `[a = 1][[b]]`;
                const expected: Type.None = Type.NoneInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[a = 1][[b]]?`, async () => {
                const expression: string = `[a = 1][[b]]?`;
                const expected: Type.Null = Type.NullInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`(1 as record)[[a]]`, async () => {
                const expression: string = `let x = (1 as record) in x[[a]]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["a", Type.AnyInstance]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`(1 as record)[[a]]?`, async () => {
                const expression: string = `let x = (1 as record) in x[[a]]?`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["a", Type.AnyInstance]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`(each [[foo]])([foo = "bar"])`, async () => {
                const expression: string = `(each [[foo]])([foo = "bar"])`;
                const expected: Type.TPowerQueryType = Type.UnknownInstance;

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`(each [[foo]])([foo = "bar", spam = "eggs"])`, async () => {
                const expression: string = `(each [[foo]])([foo = "bar", spam = "eggs"])`;

                const expectedFields: Map<string, Type.TPowerQueryType> = new Map([
                    ["foo", TypeUtils.createTextLiteral(false, `"bar"`)],
                ]);

                const eachScope: Type.TPowerQueryType = TypeUtils.createDefinedRecord(
                    false,
                    new Map([...expectedFields.entries(), ["spam", TypeUtils.createTextLiteral(false, `"eggs"`)]]),
                    false,
                );

                const testSettingsWithEachScope: InspectionSettings = {
                    ...ExtendedTestSettings,
                    eachScopeById: new Map([[5, eachScope]]),
                };

                await assertParseOkNodeTypeEqual(
                    testSettingsWithEachScope,
                    expression,
                    TypeUtils.createDefinedRecord(false, expectedFields, false),
                );
            });
        });

        describe(`${Ast.NodeKind.FieldSelector}`, () => {
            it(`[a = 1][a]`, async () => {
                const expression: string = `[a = 1][a]`;
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[a = 1][b]`, async () => {
                const expression: string = `[a = 1][b]`;
                const expected: Type.TPowerQueryType = Type.NoneInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[a = 1][b]?`, async () => {
                const expression: string = `[a = 1][b]?`;
                const expected: Type.TPowerQueryType = Type.NullInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`let x = (1 as record) in x[a]`, async () => {
                const expression: string = `let x = (1 as record) in x[a]`;
                const expected: Type.TPowerQueryType = Type.AnyInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`let x = (1 as record) in x[a]?`, async () => {
                const expression: string = `let x = (1 as record) in x[a]?`;
                const expected: Type.TPowerQueryType = Type.AnyInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            // Test for when FieldSelector is used in an EachExpression but wasn't a scope
            it(`(each [foo])([foo = "bar"])`, async () => {
                const expression: string = `(each [foo])([foo = "bar"])`;
                const expected: Type.TPowerQueryType = Type.UnknownInstance;

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            // Test for when FieldSelector is used and was given an eachScope
            it(`(each [foo])([foo = "bar"])`, async () => {
                const expression: string = `(each [foo])([foo = "bar"])`;
                const expected: Type.TPowerQueryType = TypeUtils.createTextLiteral(false, `"bar"`);

                const eachScope: Type.TPowerQueryType = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["foo", expected]]),
                    false,
                );

                const testSettingsWithEachScope: InspectionSettings = {
                    ...ExtendedTestSettings,
                    eachScopeById: new Map([[5, eachScope]]),
                };

                await assertParseOkNodeTypeEqual(testSettingsWithEachScope, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression}`, () => {
            it(`(optional x as text) => if x <> null then 1 else 2`, async () => {
                const expression: string = `(optional x as text) => if x <> null then 1 else 2`;

                const expected: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: true,
                            type: Type.TypeKind.Text,
                            nameLiteral: "x",
                        },
                    ],
                    noopTraceCreateAnyUnion([
                        {
                            isNullable: false,
                            kind: Type.TypeKind.Number,
                            literal: "1",
                            extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                            normalizedLiteral: 1,
                        },
                        {
                            isNullable: false,
                            kind: Type.TypeKind.Number,
                            literal: "2",
                            extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                            normalizedLiteral: 2,
                        },
                    ]),
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`() => 1`, async () => {
                const expression: string = `() => 1`;

                const expected: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                    false,
                    [],
                    TypeUtils.createNumberLiteral(false, "1"),
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            // Test AnyUnion return
            it(`() => if true then 1 else ""`, async () => {
                const expression: string = `() => if true then 1 else ""`;

                const expected: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                    false,
                    [],
                    noopTraceCreateAnyUnion([
                        TypeUtils.createNumberLiteral(false, "1"),
                        TypeUtils.createTextLiteral(false, `""`),
                    ]),
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`(a, b as number, c as nullable number, optional d) => 1`, async () => {
                const expression: string = `(a, b as number, c as nullable number, optional d) => 1`;

                const expected: Type.TPowerQueryType = TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            nameLiteral: "a",
                            isNullable: true,
                            isOptional: false,
                            type: undefined,
                        },
                        {
                            nameLiteral: "b",
                            isNullable: false,
                            isOptional: false,
                            type: Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "c",
                            isNullable: true,
                            isOptional: false,
                            type: Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "d",
                            isNullable: true,
                            isOptional: true,
                            type: undefined,
                        },
                    ],
                    TypeUtils.createNumberLiteral(false, "1"),
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionType}`, () => {
            it(`type function`, async () => {
                const expression: string = `type function`;
                const expected: Type.Function = Type.FunctionInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`type function () as text`, async () => {
                const expression: string = `type function () as text`;
                const expected: Type.FunctionType = TypeUtils.createFunctionType(false, [], Type.TextInstance);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, async () => {
                const expression: string = `type function (foo as number, bar as nullable text, optional baz as date) as text`;

                const expected: Type.FunctionType = TypeUtils.createFunctionType(
                    false,
                    [
                        {
                            nameLiteral: "foo",
                            isNullable: false,
                            isOptional: false,
                            type: Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "bar",
                            isNullable: true,
                            isOptional: false,
                            type: Type.TypeKind.Text,
                        },
                        {
                            nameLiteral: "baz",
                            isNullable: false,
                            isOptional: true,
                            type: Type.TypeKind.Date,
                        },
                    ],
                    Type.TextInstance,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
            it(`let x = true in x`, async () => {
                const expression: string = "let x = true in x";
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`let x = 1 in x`, async () => {
                const expression: string = "let x = 1 in x";
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if true then true else false`, async () => {
                const expression: string = `if true then true else false`;
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`if true then 1 else false`, async () => {
                const expression: string = `if true then 1 else false`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Logical),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`if if true then true else false then 1 else 0`, async () => {
                const expression: string = `if if true then true else false then 1 else ""`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createTextLiteral(false, `""`),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`if`, async () => {
                const expression: string = `if`;
                const expected: Type.TPowerQueryType = Type.UnknownInstance;
                await assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if "a"`, async () => {
                const expression: string = `if "a"`;
                const expected: Type.TPowerQueryType = Type.NoneInstance;
                await assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if true or "a"`, async () => {
                const expression: string = `if true or "a"`;
                const expected: Type.TPowerQueryType = Type.NoneInstance;
                await assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if 1 as any then "a" as text else "b" as text`, async () => {
                const expression: string = `if 1 as any then "a"as text else "b" as text`;
                const expected: Type.TPowerQueryType = TypeUtils.createPrimitiveType(false, Type.TypeKind.Text);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`if 1 as any then "a" else "b"`, async () => {
                const expression: string = `if 1 as any then "a" else "b"`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createTextLiteral(false, `"a"`),
                    TypeUtils.createTextLiteral(false, `"b"`),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`if true then 1`, async () => {
                const expression: string = `if true then 1`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Unknown),
                ]);

                await assertParseErrNodeTypeEqual(expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IsExpression}`, () => {
            it(`1 is text`, async () => {
                const expression: string = `1 is text`;
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
            it(`1 is nullable text`, async () => {
                const expression: string = `1 is nullable text`;
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{1}`, async () => {
                const expression: string = `{1}`;

                const expected: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createNumberLiteral(false, "1"),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`{1, ""}`, async () => {
                const expression: string = `{1, ""}`;

                const expected: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createTextLiteral(false, `""`),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.ListType}`, () => {
            it(`type { number }`, async () => {
                const expression: string = `type { number }`;

                const expected: Type.ListType = TypeUtils.createListType(
                    false,
                    TypeUtils.createPrimitiveType(false, Type.TypeKind.Number),
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.LiteralExpression}`, () => {
            it(`true`, async () => {
                const expression: string = "true";
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`false`, async () => {
                const expression: string = "false";
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`1`, async () => {
                const expression: string = "1";
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`null`, async () => {
                const expression: string = "null";
                const expected: Type.TPowerQueryType = TypeUtils.createPrimitiveType(true, Type.TypeKind.Null);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`{}`, async () => {
                const expression: string = `{}`;
                const expected: Type.DefinedList = TypeUtils.createDefinedList(false, []);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[]`, async () => {
                const expression: string = `[]`;
                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), false);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.NullableType}`, () => {
            it(`type nullable number`, async () => {
                const expression: string = "type nullable number";
                const expected: Type.TPowerQueryType = TypeUtils.createPrimitiveType(true, Type.TypeKind.Number);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
            it(`1 ?? 1`, async () => {
                const expression: string = `1 ?? 1`;
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`1 ?? 2`, async () => {
                const expression: string = `1 ?? 2`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createNumberLiteral(false, `2`),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`1 ?? ""`, async () => {
                const expression: string = `1 ?? ""`;

                const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                    TypeUtils.createNumberLiteral(false, "1"),
                    TypeUtils.createTextLiteral(false, `""`),
                ]);

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`1 ?? (1 + "")`, async () => {
                const expression: string = `1 ?? (1 + "")`;
                const expected: Type.None = Type.NoneInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.Parameter}`, () => {
            it(`(foo as number) => foo|`, async () => {
                const expression: string = "(foo as number) => foo|";
                const expected: Type.TPowerQueryType = Type.NumberInstance;
                await assertParseOkScopeTypeEqual(ExtendedTestSettings, expression, new Map([["foo", expected]]));
            });

            it(`(optional foo as number) => foo|`, async () => {
                const expression: string = "(optional foo as number) => foo|";
                const expected: Type.TPowerQueryType = Type.NullableNumberInstance;
                await assertParseOkScopeTypeEqual(ExtendedTestSettings, expression, new Map([["foo", expected]]));
            });

            it(`(foo) => foo|`, async () => {
                const expression: string = "(foo) => foo|";
                const expected: Type.TPowerQueryType = Type.NullableAnyInstance;
                await assertParseOkScopeTypeEqual(ExtendedTestSettings, expression, new Map([["foo", expected]]));
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`[foo = 1] & [bar = 2]`, async () => {
                const expression: string = `[foo = 1] & [bar = 2]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([
                        ["foo", TypeUtils.createNumberLiteral(false, "1")],
                        ["bar", TypeUtils.createNumberLiteral(false, "2")],
                    ]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[] & [bar = 2]`, async () => {
                const expression: string = `[] & [bar = 2]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["bar", TypeUtils.createNumberLiteral(false, "2")]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[foo = 1] & []`, async () => {
                const expression: string = `[foo = 1] & []`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["foo", TypeUtils.createNumberLiteral(false, "1")]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[foo = 1] & [foo = ""]`, async () => {
                const expression: string = `[foo = 1] & [foo = ""]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["foo", TypeUtils.createTextLiteral(false, `""`)]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[] as record & [foo = 1]`, async () => {
                const expression: string = `[] as record & [foo = 1]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["foo", TypeUtils.createNumberLiteral(false, "1")]]),
                    true,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[foo = 1] & [] as record`, async () => {
                const expression: string = `[foo = 1] & [] as record`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["foo", TypeUtils.createNumberLiteral(false, "1")]]),
                    true,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`[] as record & [] as record`, async () => {
                const expression: string = `[] as record & [] as record`;
                const expected: Type.TPowerQueryType = TypeUtils.createPrimitiveType(false, Type.TypeKind.Record);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.RecordType}`, () => {
            it(`type [foo]`, async () => {
                const expression: string = `type [foo]`;

                const expected: Type.RecordType = TypeUtils.createRecordType(
                    false,
                    new Map([["foo", Type.AnyInstance]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`type [foo, ...]`, async () => {
                const expression: string = `type [foo, ...]`;

                const expected: Type.RecordType = TypeUtils.createRecordType(
                    false,
                    new Map([["foo", Type.AnyInstance]]),
                    true,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`type [foo = number, bar = nullable text]`, async () => {
                const expression: string = `type [foo = number, bar = nullable text]`;

                const expected: Type.RecordType = TypeUtils.createRecordType(
                    false,
                    new Map([
                        ["foo", TypeUtils.createPrimitiveType(false, Type.TypeKind.Number)],
                        ["bar", TypeUtils.createPrimitiveType(true, Type.TypeKind.Text)],
                    ]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
            describe(`any is allowed`, () => {
                it(`${Ast.NodeKind.InvokeExpression}`, async () => {
                    const expression: string = `let x = (_ as any) in x()`;
                    const expected: Type.Any = Type.AnyInstance;
                    await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                });

                it(`${Ast.NodeKind.ItemAccessExpression}`, async () => {
                    const expression: string = `let x = (_ as any) in x{0}`;
                    const expected: Type.Any = Type.AnyInstance;
                    await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                });

                describe(`${Ast.NodeKind.FieldSelector}`, () => {
                    it("[a = 1][a]", async () => {
                        const expression: string = `[a = 1][a]`;
                        const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                        await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                    });

                    it("[a = 1][b]", async () => {
                        const expression: string = `[a = 1][b]`;
                        const expected: Type.None = Type.NoneInstance;
                        await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                    });

                    it("a[b]?", async () => {
                        const expression: string = `[a = 1][b]?`;
                        const expected: Type.Null = Type.NullInstance;
                        await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                    });
                });

                it(`${Ast.NodeKind.FieldProjection}`, async () => {
                    const expression: string = `let x = (_ as any) in x[[foo]]`;

                    const expected: Type.TPowerQueryType = noopTraceCreateAnyUnion([
                        TypeUtils.createDefinedRecord(false, new Map([["foo", Type.AnyInstance]]), false),
                        TypeUtils.createDefinedTable(false, new PQP.OrderedMap([["foo", Type.AnyInstance]]), false),
                    ]);

                    await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                });

                it(`${Ast.NodeKind.FieldSelector}`, async () => {
                    const expression: string = `[a = 1][a]`;
                    const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                    await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
                });
            });

            it(`let x = () as function => () as number => 1 in x()()`, async () => {
                const expression: string = `let x = () as function => () as number => 1 in x()()`;
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`Recursive identifiers`, () => {
            it(`let foo = 1 in [foo = foo]`, async () => {
                const expression: string = `let foo = 1 in [foo = foo]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["foo", TypeUtils.createNumberLiteral(false, "1")]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`let foo = 1 in [foo = foo, bar = foo]`, async () => {
                const expression: string = `let foo = 1 in [foo = foo, bar = foo]`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([
                        ["foo", TypeUtils.createNumberLiteral(false, 1)],
                        ["bar", TypeUtils.createNumberLiteral(false, 1)],
                    ]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`let someIdentifier = 1, result = let someIdentifier = 2 in [ outer = someIdentifier, inner = @someIdentifier ] in result`, async () => {
                const expression: string = `
    let
        someIdentifier = 1,
        result =
            let
                someIdentifier = 2
            in
                [
                    outer = someIdentifier,
                    inner = @someIdentifier
                ]
in
    result`;

                const expected: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([
                        ["outer", TypeUtils.createNumberLiteral(false, 2)],
                        ["inner", TypeUtils.createNumberLiteral(false, 2)],
                    ]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.TableType}`, () => {
            it(`type table [foo]`, async () => {
                const expression: string = `type table [foo]`;

                const expected: Type.TableType = TypeUtils.createTableType(
                    false,
                    new Map([["foo", Type.AnyInstance]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`type table [foo]`, async () => {
                const expression: string = `type table [foo]`;

                const expected: Type.TableType = TypeUtils.createTableType(
                    false,
                    new Map([["foo", Type.AnyInstance]]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`type table [foo = number, bar = nullable text]`, async () => {
                const expression: string = `type table [foo = number, bar = nullable text]`;

                const expected: Type.TableType = TypeUtils.createTableType(
                    false,
                    new Map([
                        ["foo", TypeUtils.createPrimitiveType(false, Type.TypeKind.Number)],
                        ["bar", TypeUtils.createPrimitiveType(true, Type.TypeKind.Text)],
                    ]),
                    false,
                );

                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`${Ast.NodeKind.UnaryExpression}`, () => {
            it(`+1`, async () => {
                const expression: string = `+1`;
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "+1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`-1`, async () => {
                const expression: string = `-1`;
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "-1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`--1`, async () => {
                const expression: string = `--1`;
                const expected: Type.NumberLiteral = TypeUtils.createNumberLiteral(false, "--1");
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`not true`, async () => {
                const expression: string = `not true`;
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`not false`, async () => {
                const expression: string = `not false`;
                const expected: Type.Logical = Type.LogicalInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`not 1`, async () => {
                const expression: string = `not 1`;
                const expected: Type.None = Type.NoneInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`+true`, async () => {
                const expression: string = `+true`;
                const expected: Type.TPowerQueryType = TypeUtils.createPrimitiveType(false, Type.TypeKind.None);
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });
    });

    describe(`primitive static analysis`, () => {
        it(`${Ast.NodeKind.ListExpression}`, async () => {
            const expression: string = `{1, 2}`;
            const expected: Type.List = Type.ListInstance;
            await assertParseOkNodeTypeEqual(PrimitiveTestSettings, expression, expected);
        });

        it(`${Ast.NodeKind.ListType}`, async () => {
            const expression: string = `type { foo }`;
            const expected: Type.Type = Type.TypePrimitiveInstance;
            await assertParseOkNodeTypeEqual(PrimitiveTestSettings, expression, expected);
        });

        it(`${Ast.NodeKind.RangeExpression}`, async () => {
            const expression: string = `{0..1}`;
            const expected: Type.List = Type.ListInstance;
            await assertParseOkNodeTypeEqual(PrimitiveTestSettings, expression, expected);
        });

        it(`${Ast.NodeKind.RecordExpression}`, async () => {
            const expression: string = `[foo = "bar"]`;
            const expected: Type.Record = Type.RecordInstance;
            await assertParseOkNodeTypeEqual(PrimitiveTestSettings, expression, expected);
        });

        it(`${Ast.NodeKind.RecordType}`, async () => {
            const expression: string = `type [foo]`;
            const expected: Type.Type = Type.TypePrimitiveInstance;
            await assertParseOkNodeTypeEqual(PrimitiveTestSettings, expression, expected);
        });

        it(`inclusve identifier`, async () => {
            const expression: string = `let foo = @foo in foo`;
            const expected: Type.Any = Type.AnyInstance;
            await assertParseOkNodeTypeEqual(PrimitiveTestSettings, expression, expected);
        });
    });

    describe(`external type`, () => {
        describe(`value`, () => {
            it(`resolves to external type`, async () => {
                const expression: string = `foo`;
                const expected: Type.Function = Type.FunctionInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`indirect identifier resolves to external type`, async () => {
                const expression: string = `let bar = foo in bar`;
                const expected: Type.Function = Type.FunctionInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`fails to resolve to external type`, async () => {
                const expression: string = `bar`;
                const expected: Type.Unknown = Type.UnknownInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });
        });

        describe(`invocation`, () => {
            it(`resolves with identifier`, async () => {
                const expression: string = `foo()`;
                const expected: Type.Text = Type.TextInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`resolves with deferenced identifier`, async () => {
                const expression: string = `let bar = foo in bar()`;
                const expected: Type.Text = Type.TextInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression, expected);
            });

            it(`resolves based on argument`, async () => {
                const expression1: string = `foo()`;
                const expected1: Type.Text = Type.TextInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression1, expected1);

                const expression2: string = `foo("bar")`;
                const expected2: Type.Number = Type.NumberInstance;
                await assertParseOkNodeTypeEqual(ExtendedTestSettings, expression2, expected2);
            });
        });
    });
});
