// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";
import type { Position } from "vscode-languageserver-types";

import { TestUtils } from "..";
import { Inspection } from "../../powerquery-language-services";

const ExternalTypeResolver: Inspection.ExternalType.TExternalTypeResolverFn = (
    request: Inspection.ExternalType.TExternalTypeRequest,
) => {
    switch (request.kind) {
        case Inspection.ExternalType.ExternalTypeRequestKind.Invocation: {
            if (request.identifierLiteral !== "foo") {
                return undefined;
            }

            return request.args.length === 0 ? PQP.Language.Type.TextInstance : PQP.Language.Type.NumberInstance;
        }

        case Inspection.ExternalType.ExternalTypeRequestKind.Value:
            return request.identifierLiteral === "foo" ? PQP.Language.Type.FunctionInstance : undefined;

        default:
            throw Assert.isNever(request);
    }
};

const TestSettings: PQP.Settings & Inspection.InspectionSettings = {
    ...PQP.DefaultSettings,
    maybeExternalTypeResolver: ExternalTypeResolver,
};

function assertParseOkNodeTypeEqual<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: Inspection.InspectionSettings<S>,
    text: string,
    expected: PQP.Language.Type.PowerQueryType,
): void {
    const parseOk: PQP.Task.ParseTaskOk = TestUtils.assertGetLexParseOk(TestSettings, text);

    const actual: PQP.Language.Type.PowerQueryType = assertGetParseNodeOk(
        settings,
        parseOk.nodeIdMapCollection,
        PQP.Parser.XorNodeUtils.createAstNode(parseOk.ast),
    );

    expect(actual).deep.equal(expected);
}

function assertParseErrNodeTypeEqual(text: string, expected: PQP.Language.Type.PowerQueryType): void {
    const parseError: PQP.Task.ParseTaskParseError = TestUtils.assertGetLexParseError(TestSettings, text);

    const actual: PQP.Language.Type.PowerQueryType = assertGetParseNodeOk(
        TestSettings,
        parseError.nodeIdMapCollection,
        PQP.Parser.XorNodeUtils.createContextNode(Assert.asDefined(parseError.parseState.contextState.maybeRoot)),
    );

    expect(actual).deep.equal(expected);
}

function assertGetParseNodeOk<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: Inspection.InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    xorNode: PQP.Parser.TXorNode,
): PQP.Language.Type.PowerQueryType {
    const triedType: Inspection.TriedType = Inspection.tryType(settings, nodeIdMapCollection, xorNode.node.id);
    Assert.isOk(triedType);

    return triedType.value;
}

function assertParseOkScopeTypeEqual<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: Inspection.InspectionSettings<S>,
    textWithPipe: string,
    expected: Inspection.ScopeTypeByKey,
): void {
    const [textWithoutPipe, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPipe);
    const parseOk: PQP.Task.ParseTaskOk = TestUtils.assertGetLexParseOk(TestSettings, textWithoutPipe);

    const actual: Inspection.ScopeTypeByKey = assertGetParseOkScopeTypeOk(
        settings,
        parseOk.nodeIdMapCollection,
        position,
    );

    expect(actual).deep.equal(expected);
}

function assertGetParseOkScopeTypeOk<S extends PQP.Parser.IParseState = PQP.Parser.IParseState>(
    settings: Inspection.InspectionSettings<S>,
    nodeIdMapCollection: PQP.Parser.NodeIdMap.Collection,
    position: Position,
): Inspection.ScopeTypeByKey {
    const activeNodeLeaf: PQP.Parser.TXorNode = Inspection.ActiveNodeUtils.assertGetLeaf(
        Inspection.ActiveNodeUtils.assertActiveNode(nodeIdMapCollection, position),
    );
    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        activeNodeLeaf.node.id,
    );
    Assert.isOk(triedScopeType);

    return triedScopeType.value;
}

describe(`Inspection - Type`, () => {
    describe(`static analysis`, () => {
        describe("BinOpExpression", () => {
            it(`1 + 1`, () => {
                const expression: string = "1 + 1";
                const expected: PQP.Language.Type.Number = PQP.Language.Type.NumberInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`true and false`, () => {
                const expression: string = `true and false`;
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`"hello" & "world"`, () => {
                const expression: string = `"hello" & "world"`;
                const expected: PQP.Language.Type.Text = PQP.Language.Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`true + 1`, () => {
                const expression: string = `true + 1`;
                const expected: PQP.Language.Type.None = PQP.Language.Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.AsNullablePrimitiveType}`, () => {
            it(`(foo as number, bar as nullable number) => foo + bar|`, () => {
                const expression: string = `(foo as number, bar as nullable number) => foo + bar|`;
                const expected: Inspection.ScopeTypeByKey = new Map<string, PQP.Language.Type.PowerQueryType>([
                    ["foo", PQP.Language.Type.NumberInstance],
                    ["bar", PQP.Language.Type.NullableNumberInstance],
                ]);
                assertParseOkScopeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.AsExpression}`, () => {
            it(`1 as number`, () => {
                const expression: string = `1 as number`;
                const expected: PQP.Language.Type.Number = PQP.Language.Type.NumberInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 as text`, () => {
                const expression: string = `1 as text`;
                const expected: PQP.Language.Type.Text = PQP.Language.Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 as any`, () => {
                const expression: string = `1 as any`;
                const expected: PQP.Language.Type.Any = PQP.Language.Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.EachExpression}`, () => {
            it(`each 1`, () => {
                const expression: string = `each 1`;
                const expected: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: false,
                            maybeType: PQP.Language.Type.TypeKind.Any,
                            nameLiteral: "_",
                        },
                    ],
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try 1`, () => {
                const expression: string = `try 1`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Record),
                ]);

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`try 1 otherwise false`, () => {
                const expression: string = `try 1 otherwise false`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Logical),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error 1`, () => {
                const expression: string = `error 1`;
                const expected: PQP.Language.Type.Any = PQP.Language.Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.FieldProjection}`, () => {
            it(`[a = 1][[a]]`, () => {
                const expression: string = `[a = 1][[a]]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["a", PQP.Language.TypeUtils.createNumberLiteral(false, "1")],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][[b]]`, () => {
                const expression: string = `[a = 1][[b]]`;
                const expected: PQP.Language.Type.None = PQP.Language.Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][[b]]?`, () => {
                const expression: string = `[a = 1][[b]]?`;
                const expected: PQP.Language.Type.Null = PQP.Language.Type.NullInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`(1 as record)[[a]]`, () => {
                const expression: string = `let x = (1 as record) in x[[a]]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([["a", PQP.Language.Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`(1 as record)[[a]]?`, () => {
                const expression: string = `let x = (1 as record) in x[[a]]?`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([["a", PQP.Language.Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.FieldSelector}`, () => {
            it(`[a = 1][a]`, () => {
                const expression: string = `[a = 1][a]`;
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][b]`, () => {
                const expression: string = `[a = 1][b]`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[a = 1][b]?`, () => {
                const expression: string = `[a = 1][b]?`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.NullInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`let x = (1 as record) in x[a]`, () => {
                const expression: string = `let x = (1 as record) in x[a]`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`let x = (1 as record) in x[a]?`, () => {
                const expression: string = `let x = (1 as record) in x[a]?`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.AnyInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.FunctionExpression}`, () => {
            it(`() => 1`, () => {
                const expression: string = `() => 1`;
                const expected: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
                    false,
                    [],
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                );

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            // Test AnyUnion return
            it(`() => if true then 1 else ""`, () => {
                const expression: string = `() => if true then 1 else ""`;
                const expected: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
                    false,
                    [],
                    PQP.Language.TypeUtils.createAnyUnion([
                        PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                        PQP.Language.TypeUtils.createTextLiteral(false, `""`),
                    ]),
                );

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`(a, b as number, c as nullable number, optional d) => 1`, () => {
                const expression: string = `(a, b as number, c as nullable number, optional d) => 1`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            nameLiteral: "a",
                            isNullable: true,
                            isOptional: false,
                            maybeType: undefined,
                        },
                        {
                            nameLiteral: "b",
                            isNullable: false,
                            isOptional: false,
                            maybeType: PQP.Language.Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "c",
                            isNullable: true,
                            isOptional: false,
                            maybeType: PQP.Language.Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "d",
                            isNullable: true,
                            isOptional: true,
                            maybeType: undefined,
                        },
                    ],
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.FunctionType}`, () => {
            it(`type function`, () => {
                const expression: string = `type function`;
                const expected: PQP.Language.Type.Function = PQP.Language.Type.FunctionInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type function () as text`, () => {
                const expression: string = `type function () as text`;
                const expected: PQP.Language.Type.FunctionType = PQP.Language.TypeUtils.createFunctionType(
                    false,
                    [],
                    PQP.Language.Type.TextInstance,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, () => {
                const expression: string = `type function (foo as number, bar as nullable text, optional baz as date) as text`;
                const expected: PQP.Language.Type.FunctionType = PQP.Language.TypeUtils.createFunctionType(
                    false,
                    [
                        {
                            nameLiteral: "foo",
                            isNullable: false,
                            isOptional: false,
                            maybeType: PQP.Language.Type.TypeKind.Number,
                        },
                        {
                            nameLiteral: "bar",
                            isNullable: true,
                            isOptional: false,
                            maybeType: PQP.Language.Type.TypeKind.Text,
                        },
                        {
                            nameLiteral: "baz",
                            isNullable: false,
                            isOptional: true,
                            maybeType: PQP.Language.Type.TypeKind.Date,
                        },
                    ],
                    PQP.Language.Type.TextInstance,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.IdentifierExpression}`, () => {
            it(`let x = true in x`, () => {
                const expression: string = "let x = true in x";
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`let x = 1 in x`, () => {
                const expression: string = "let x = 1 in x";
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.IfExpression}`, () => {
            it(`if true then true else false`, () => {
                const expression: string = `if true then true else false`;
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if true then 1 else false`, () => {
                const expression: string = `if true then 1 else false`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Logical),
                ]);

                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if if true then true else false then 1 else 0`, () => {
                const expression: string = `if if true then true else false then 1 else ""`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createTextLiteral(false, `""`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if`, () => {
                const expression: string = `if`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.UnknownInstance;
                assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if "a"`, () => {
                const expression: string = `if "a"`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.NoneInstance;
                assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if true or "a"`, () => {
                const expression: string = `if true or "a"`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.Type.NoneInstance;
                assertParseErrNodeTypeEqual(expression, expected);
            });

            it(`if 1 as any then "a" as text else "b" as text`, () => {
                const expression: string = `if 1 as any then "a"as text else "b" as text`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createPrimitiveType(
                    false,
                    PQP.Language.Type.TypeKind.Text,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if 1 as any then "a" else "b"`, () => {
                const expression: string = `if 1 as any then "a" else "b"`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createTextLiteral(false, `"a"`),
                    PQP.Language.TypeUtils.createTextLiteral(false, `"b"`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`if true then 1`, () => {
                const expression: string = `if true then 1`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Unknown),
                ]);
                assertParseErrNodeTypeEqual(expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.IsExpression}`, () => {
            it(`1 is text`, () => {
                const expression: string = `1 is text`;
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.IsNullablePrimitiveType}`, () => {
            it(`1 is nullable text`, () => {
                const expression: string = `1 is nullable text`;
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.ListExpression}`, () => {
            it(`{1}`, () => {
                const expression: string = `{1}`;
                const expected: PQP.Language.Type.DefinedList = PQP.Language.TypeUtils.createDefinedList(false, [
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`{1, ""}`, () => {
                const expression: string = `{1, ""}`;
                const expected: PQP.Language.Type.DefinedList = PQP.Language.TypeUtils.createDefinedList(false, [
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createTextLiteral(false, `""`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.ListType}`, () => {
            it(`type { number }`, () => {
                const expression: string = `type { number }`;
                const expected: PQP.Language.Type.ListType = PQP.Language.TypeUtils.createListType(
                    false,
                    PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Number),
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.LiteralExpression}`, () => {
            it(`true`, () => {
                const expression: string = "true";
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`false`, () => {
                const expression: string = "false";
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1`, () => {
                const expression: string = "1";
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`null`, () => {
                const expression: string = "null";
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createPrimitiveType(
                    true,
                    PQP.Language.Type.TypeKind.Null,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`{}`, () => {
                const expression: string = `{}`;
                const expected: PQP.Language.Type.DefinedList = PQP.Language.TypeUtils.createDefinedList(false, []);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
            it(`[]`, () => {
                const expression: string = `[]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map(),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.NullableType}`, () => {
            it(`type nullable number`, () => {
                const expression: string = "type nullable number";
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createPrimitiveType(
                    true,
                    PQP.Language.Type.TypeKind.Number,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.NullCoalescingExpression}`, () => {
            it(`1 ?? 1`, () => {
                const expression: string = `1 ?? 1`;
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 ?? 2`, () => {
                const expression: string = `1 ?? 2`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createNumberLiteral(false, `2`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 ?? ""`, () => {
                const expression: string = `1 ?? ""`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                    PQP.Language.TypeUtils.createNumberLiteral(false, "1"),
                    PQP.Language.TypeUtils.createTextLiteral(false, `""`),
                ]);
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`1 ?? (1 + "")`, () => {
                const expression: string = `1 ?? (1 + "")`;
                const expected: PQP.Language.Type.None = PQP.Language.Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.RecordExpression}`, () => {
            it(`[foo = 1] & [bar = 2]`, () => {
                const expression: string = `[foo = 1] & [bar = 2]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createNumberLiteral(false, "1")],
                        ["bar", PQP.Language.TypeUtils.createNumberLiteral(false, "2")],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[] & [bar = 2]`, () => {
                const expression: string = `[] & [bar = 2]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["bar", PQP.Language.TypeUtils.createNumberLiteral(false, "2")],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[foo = 1] & []`, () => {
                const expression: string = `[foo = 1] & []`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createNumberLiteral(false, "1")],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[foo = 1] & [foo = ""]`, () => {
                const expression: string = `[foo = 1] & [foo = ""]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createTextLiteral(false, `""`)],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[] as record & [foo = 1]`, () => {
                const expression: string = `[] as record & [foo = 1]`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createNumberLiteral(false, "1")],
                    ]),
                    true,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[foo = 1] & [] as record`, () => {
                const expression: string = `[foo = 1] & [] as record`;
                const expected: PQP.Language.Type.DefinedRecord = PQP.Language.TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createNumberLiteral(false, "1")],
                    ]),
                    true,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`[] as record & [] as record`, () => {
                const expression: string = `[] as record & [] as record`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createPrimitiveType(
                    false,
                    PQP.Language.Type.TypeKind.Record,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.RecordType}`, () => {
            it(`type [foo]`, () => {
                const expression: string = `type [foo]`;
                const expected: PQP.Language.Type.RecordType = PQP.Language.TypeUtils.createRecordType(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([["foo", PQP.Language.Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type [foo, ...]`, () => {
                const expression: string = `type [foo, ...]`;
                const expected: PQP.Language.Type.RecordType = PQP.Language.TypeUtils.createRecordType(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([["foo", PQP.Language.Type.AnyInstance]]),
                    true,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type [foo = number, bar = nullable text]`, () => {
                const expression: string = `type [foo = number, bar = nullable text]`;
                const expected: PQP.Language.Type.RecordType = PQP.Language.TypeUtils.createRecordType(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Number)],
                        ["bar", PQP.Language.TypeUtils.createPrimitiveType(true, PQP.Language.Type.TypeKind.Text)],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.RecursivePrimaryExpression}`, () => {
            describe(`any is allowed`, () => {
                it(`${PQP.Language.Ast.NodeKind.InvokeExpression}`, () => {
                    const expression: string = `let x = (_ as any) in x()`;
                    const expected: PQP.Language.Type.Any = PQP.Language.Type.AnyInstance;
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });

                it(`${PQP.Language.Ast.NodeKind.ItemAccessExpression}`, () => {
                    const expression: string = `let x = (_ as any) in x{0}`;
                    const expected: PQP.Language.Type.Any = PQP.Language.Type.AnyInstance;
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });

                describe(`${PQP.Language.Ast.NodeKind.FieldSelector}`, () => {
                    it("[a = 1][a]", () => {
                        const expression: string = `[a = 1][a]`;
                        const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                            false,
                            "1",
                        );
                        assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                    });

                    it("[a = 1][b]", () => {
                        const expression: string = `[a = 1][b]`;
                        const expected: PQP.Language.Type.None = PQP.Language.Type.NoneInstance;
                        assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                    });

                    it("a[b]?", () => {
                        const expression: string = `[a = 1][b]?`;
                        const expected: PQP.Language.Type.Null = PQP.Language.Type.NullInstance;
                        assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                    });
                });

                it(`${PQP.Language.Ast.NodeKind.FieldProjection}`, () => {
                    const expression: string = `let x = (_ as any) in x[[foo]]`;
                    const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createAnyUnion([
                        PQP.Language.TypeUtils.createDefinedRecord(
                            false,
                            new Map<string, PQP.Language.Type.PowerQueryType>([["foo", PQP.Language.Type.AnyInstance]]),
                            false,
                        ),
                        PQP.Language.TypeUtils.createDefinedTable(
                            false,
                            new Map<string, PQP.Language.Type.PowerQueryType>([["foo", PQP.Language.Type.AnyInstance]]),
                            false,
                        ),
                    ]);
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });

                it(`${PQP.Language.Ast.NodeKind.FieldSelector}`, () => {
                    const expression: string = `[a = 1][a]`;
                    const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                        false,
                        "1",
                    );
                    assertParseOkNodeTypeEqual(TestSettings, expression, expected);
                });
            });

            it(`let x = () as function => () as number => 1 in x()()`, () => {
                const expression: string = `let x = () as function => () as number => 1 in x()()`;
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.TableType}`, () => {
            it(`type table [foo]`, () => {
                const expression: string = `type table [foo]`;
                const expected: PQP.Language.Type.TableType = PQP.Language.TypeUtils.createTableType(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([["foo", PQP.Language.Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type table [foo]`, () => {
                const expression: string = `type table [foo]`;
                const expected: PQP.Language.Type.TableType = PQP.Language.TypeUtils.createTableType(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([["foo", PQP.Language.Type.AnyInstance]]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`type table [foo = number, bar = nullable text]`, () => {
                const expression: string = `type table [foo = number, bar = nullable text]`;
                const expected: PQP.Language.Type.TableType = PQP.Language.TypeUtils.createTableType(
                    false,
                    new Map<string, PQP.Language.Type.PowerQueryType>([
                        ["foo", PQP.Language.TypeUtils.createPrimitiveType(false, PQP.Language.Type.TypeKind.Number)],
                        ["bar", PQP.Language.TypeUtils.createPrimitiveType(true, PQP.Language.Type.TypeKind.Text)],
                    ]),
                    false,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`${PQP.Language.Ast.NodeKind.UnaryExpression}`, () => {
            it(`+1`, () => {
                const expression: string = `+1`;
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "+1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`-1`, () => {
                const expression: string = `-1`;
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "-1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`--1`, () => {
                const expression: string = `--1`;
                const expected: PQP.Language.Type.NumberLiteral = PQP.Language.TypeUtils.createNumberLiteral(
                    false,
                    "--1",
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`not true`, () => {
                const expression: string = `not true`;
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`not false`, () => {
                const expression: string = `not false`;
                const expected: PQP.Language.Type.Logical = PQP.Language.Type.LogicalInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`not 1`, () => {
                const expression: string = `not 1`;
                const expected: PQP.Language.Type.None = PQP.Language.Type.NoneInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`+true`, () => {
                const expression: string = `+true`;
                const expected: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.createPrimitiveType(
                    false,
                    PQP.Language.Type.TypeKind.None,
                );
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });
    });

    describe(`external type`, () => {
        describe(`value`, () => {
            it(`resolves to external type`, () => {
                const expression: string = `foo`;
                const expected: PQP.Language.Type.Function = PQP.Language.Type.FunctionInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`indirect identifier resolves to external type`, () => {
                const expression: string = `let bar = foo in bar`;
                const expected: PQP.Language.Type.Function = PQP.Language.Type.FunctionInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`fails to resolve to external type`, () => {
                const expression: string = `bar`;
                const expected: PQP.Language.Type.Unknown = PQP.Language.Type.UnknownInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });
        });

        describe(`invocation`, () => {
            it(`resolves with identifier`, () => {
                const expression: string = `foo()`;
                const expected: PQP.Language.Type.Text = PQP.Language.Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`resolves with deferenced identifier`, () => {
                const expression: string = `let bar = foo in bar()`;
                const expected: PQP.Language.Type.Text = PQP.Language.Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression, expected);
            });

            it(`resolves based on argument`, () => {
                const expression1: string = `foo()`;
                const expected1: PQP.Language.Type.Text = PQP.Language.Type.TextInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression1, expected1);

                const expression2: string = `foo("bar")`;
                const expected2: PQP.Language.Type.Number = PQP.Language.Type.NumberInstance;
                assertParseOkNodeTypeEqual(TestSettings, expression2, expected2);
            });
        });
    });
});
