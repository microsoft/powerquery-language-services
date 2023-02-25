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
            if (request.identifierLiteral !== `foo`) {
                return undefined;
            }

            return request.args.length === 0 ? Type.TextInstance : Type.NumberInstance;
        }

        case ExternalType.ExternalTypeRequestKind.Value:
            return request.identifierLiteral === `foo` ? Type.FunctionInstance : undefined;

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
    text: string,
    expected: Type.TPowerQueryType,
    settings: InspectionSettings = ExtendedTestSettings,
): Promise<void> {
    const parseOk: PQP.Task.ParseTaskOk = await TestUtils.assertGetLexParseOk(settings, text);

    const actual: Type.TPowerQueryType = await assertGetParseNodeOk(
        parseOk.nodeIdMapCollection,
        XorNodeUtils.boxAst(parseOk.ast),
        settings,
    );

    expect(actual).deep.equal(expected);
}

async function assertParseErrNodeTypeEqual(text: string, expected: Type.TPowerQueryType): Promise<void> {
    const parseError: PQP.Task.ParseTaskParseError = await TestUtils.assertGetLexParseError(ExtendedTestSettings, text);

    const actual: Type.TPowerQueryType = await assertGetParseNodeOk(
        parseError.nodeIdMapCollection,
        XorNodeUtils.boxContext(Assert.asDefined(parseError.parseState.contextState.root)),
        ExtendedTestSettings,
    );

    expect(actual).deep.equal(expected);
}

async function assertGetParseNodeOk(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    settings: InspectionSettings,
): Promise<Type.TPowerQueryType> {
    const triedType: Inspection.TriedType = await Inspection.tryType(settings, nodeIdMapCollection, xorNode.node.id);
    Assert.isOk(triedType);

    return triedType.value;
}

async function assertParseOkScopeTypeEqual(
    textWithPipe: string,
    expected: Inspection.ScopeTypeByKey,
    settings?: InspectionSettings,
): Promise<void> {
    settings = settings ?? ExtendedTestSettings;

    const [textWithoutPipe, position]: [string, Position] = TestUtils.assertGetTextAndExtractPosition(textWithPipe);
    const parseOk: PQP.Task.ParseTaskOk = await TestUtils.assertGetLexParseOk(settings, textWithoutPipe);

    const actual: Inspection.ScopeTypeByKey = await assertGetParseOkScopeTypeOk(
        parseOk.nodeIdMapCollection,
        position,
        settings,
    );

    expect(actual).deep.equal(expected);
}

async function assertGetParseOkScopeTypeOk(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    settings?: InspectionSettings,
): Promise<Inspection.ScopeTypeByKey> {
    settings = settings ?? ExtendedTestSettings;

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

const anyUnion: (unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType = (
    unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.createAnyUnion(unionedTypePairs, NoOpTraceManagerInstance, undefined);

describe(`Inspection - Type`, () => {
    describe(`extended static analysis`, () => {
        describe(`BinOpExpression`, () => {
            it(`1 + 1`, async () => await assertParseOkNodeTypeEqual(`1 + 1`, Type.NumberInstance));

            it(`true and false`, async () => await assertParseOkNodeTypeEqual(`true and false`, Type.LogicalInstance));

            it(`"hello" & "world"`, async () =>
                await assertParseOkNodeTypeEqual(`"hello" & "world"`, Type.TextInstance));

            it(`true + 1`, async () => await assertParseOkNodeTypeEqual(`true + 1`, Type.NoneInstance));
        });

        describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
            it(`(foo as number, bar as nullable number) => foo + bar|`, async () =>
                await assertParseOkScopeTypeEqual(
                    `(foo as number, bar as nullable number) => foo + bar|`,
                    new Map([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableNumberInstance],
                    ]),
                ));
        });

        describe(`${Ast.NodeKind.AsExpression}`, () => {
            it(`1 as number`, async () => await assertParseOkNodeTypeEqual(`1 as number`, Type.NumberInstance));

            it(`1 as text`, async () => await assertParseOkNodeTypeEqual(`1 as text`, Type.TextInstance));

            it(`1 as any`, async () => await assertParseOkNodeTypeEqual(`1 as any`, Type.AnyInstance));
        });

        describe(`${Ast.NodeKind.EachExpression}`, () => {
            it(`each 1`, async () =>
                await assertParseOkNodeTypeEqual(
                    `each 1`,
                    TypeUtils.createDefinedFunction(
                        false,
                        [
                            {
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Any,
                                nameLiteral: `_`,
                            },
                        ],
                        TypeUtils.createNumberLiteral(false, `1`),
                    ),
                ));
        });

        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try 1`, async () =>
                await assertParseOkNodeTypeEqual(
                    `try 1`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.RecordInstance]),
                ));

            it(`try 1 otherwise false`, async () => {
                await assertParseOkNodeTypeEqual(
                    `try 1 otherwise false`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.LogicalInstance]),
                );
            });

            it(`try 1 otherwise`, async () =>
                await assertParseErrNodeTypeEqual(
                    `try 1 otherwise`,
                    anyUnion([Type.UnknownInstance, TypeUtils.createNumberLiteral(false, `1`)]),
                ));

            it(`try true catch () => 1)`, async () =>
                await assertParseOkNodeTypeEqual(
                    `try true catch () => 1`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.LogicalInstance]),
                ));

            it(`try true catch`, async () =>
                await assertParseErrNodeTypeEqual(
                    `try true catch`,
                    anyUnion([Type.LogicalInstance, Type.UnknownInstance]),
                ));
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error 1`, async () => await assertParseOkNodeTypeEqual(`error 1`, Type.AnyInstance));
        });

        describe(`${Ast.NodeKind.FieldProjection}`, () => {
            it(`[a = 1][[a]]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `[a = 1][[a]]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`a`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        false,
                    ),
                ));

            it(`[a = 1][[b]]`, async () => await assertParseOkNodeTypeEqual(`[a = 1][[b]]`, Type.NoneInstance));

            it(`[a = 1][[b]]?`, async () => await assertParseOkNodeTypeEqual(`[a = 1][[b]]?`, Type.NullInstance));

            it(`(1 as record)[[a]]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `let x = (1 as record) in x[[a]]`,
                    TypeUtils.createDefinedRecord(false, new Map([[`a`, Type.AnyInstance]]), false),
                ));

            it(`(1 as record)[[a]]?`, async () =>
                await assertParseOkNodeTypeEqual(
                    `let x = (1 as record) in x[[a]]?`,
                    TypeUtils.createDefinedRecord(false, new Map([[`a`, Type.AnyInstance]]), false),
                ));

            it(`(each [[foo]])([foo = "bar"])`, async () =>
                await assertParseOkNodeTypeEqual(`(each [[foo]])([foo = "bar"])`, Type.UnknownInstance));

            it(`(each [[foo]])([foo = "bar", spam = "eggs"])`, async () => {
                const expression: string = `(each [[foo]])([foo = "bar", spam = "eggs"])`;

                const expectedFields: Map<string, Type.TPowerQueryType> = new Map([
                    [`foo`, TypeUtils.createTextLiteral(false, `"bar"`)],
                ]);

                const eachScope: Type.TPowerQueryType = TypeUtils.createDefinedRecord(
                    false,
                    new Map([...expectedFields.entries(), [`spam`, TypeUtils.createTextLiteral(false, `"eggs"`)]]),
                    false,
                );

                const testSettingsWithEachScope: InspectionSettings = {
                    ...ExtendedTestSettings,
                    eachScopeById: new Map([[5, eachScope]]),
                };

                await assertParseOkNodeTypeEqual(
                    expression,
                    TypeUtils.createDefinedRecord(false, expectedFields, false),
                    testSettingsWithEachScope,
                );
            });
        });

        describe(`${Ast.NodeKind.FieldSelector}`, () => {
            it(`[a = 1][a]`, async () =>
                await assertParseOkNodeTypeEqual(`[a = 1][a]`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`[a = 1][b]`, async () => await assertParseOkNodeTypeEqual(`[a = 1][b]`, Type.NoneInstance));

            it(`[a = 1][b]?`, async () => await assertParseOkNodeTypeEqual(`[a = 1][b]?`, Type.NullInstance));

            it(`let x = (1 as record) in x[a]`, async () =>
                await assertParseOkNodeTypeEqual(`let x = (1 as record) in x[a]`, Type.AnyInstance));

            it(`let x = (1 as record) in x[a]?`, async () =>
                await assertParseOkNodeTypeEqual(`let x = (1 as record) in x[a]?`, Type.AnyInstance));

            // Test for when FieldSelector is used in an EachExpression but wasn't a scope
            it(`(each [foo])([foo = "bar"])`, async () =>
                await assertParseOkNodeTypeEqual(`(each [foo])([foo = "bar"])`, Type.UnknownInstance));

            // Test for when FieldSelector is used and was given an eachScope
            it(`(each [foo])([foo = "bar"])`, async () => {
                const expression: string = `(each [foo])([foo = "bar"])`;
                const expected: Type.TPowerQueryType = TypeUtils.createTextLiteral(false, `"bar"`);

                const eachScope: Type.TPowerQueryType = TypeUtils.createDefinedRecord(
                    false,
                    new Map([[`foo`, expected]]),
                    false,
                );

                const testSettingsWithEachScope: InspectionSettings = {
                    ...ExtendedTestSettings,
                    eachScopeById: new Map([[5, eachScope]]),
                };

                await assertParseOkNodeTypeEqual(expression, expected, testSettingsWithEachScope);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression}`, () => {
            it(`(optional x as text) => if x <> null then 1 else 2`, async () =>
                await assertParseOkNodeTypeEqual(
                    `(optional x as text) => if x <> null then 1 else 2`,
                    TypeUtils.createDefinedFunction(
                        false,
                        [
                            {
                                isNullable: false,
                                isOptional: true,
                                type: Type.TypeKind.Text,
                                nameLiteral: `x`,
                            },
                        ],
                        anyUnion([
                            {
                                isNullable: false,
                                kind: Type.TypeKind.Number,
                                literal: `1`,
                                extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                                normalizedLiteral: 1,
                            },
                            {
                                isNullable: false,
                                kind: Type.TypeKind.Number,
                                literal: `2`,
                                extendedKind: Type.ExtendedTypeKind.NumberLiteral,
                                normalizedLiteral: 2,
                            },
                        ]),
                    ),
                ));

            it(`() => 1`, async () =>
                await assertParseOkNodeTypeEqual(
                    `() => 1`,
                    TypeUtils.createDefinedFunction(false, [], TypeUtils.createNumberLiteral(false, `1`)),
                ));

            // Test AnyUnion return
            it(`() => if true then 1 else ""`, async () =>
                await assertParseOkNodeTypeEqual(
                    `() => if true then 1 else ""`,
                    TypeUtils.createDefinedFunction(
                        false,
                        [],
                        anyUnion([TypeUtils.createNumberLiteral(false, `1`), TypeUtils.createTextLiteral(false, `""`)]),
                    ),
                ));

            it(`(a, b as number, c as nullable number, optional d) => 1`, async () =>
                await assertParseOkNodeTypeEqual(
                    `(a, b as number, c as nullable number, optional d) => 1`,
                    TypeUtils.createDefinedFunction(
                        false,
                        [
                            {
                                nameLiteral: `a`,
                                isNullable: true,
                                isOptional: false,
                                type: undefined,
                            },
                            {
                                nameLiteral: `b`,
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                            },
                            {
                                nameLiteral: `c`,
                                isNullable: true,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                            },
                            {
                                nameLiteral: `d`,
                                isNullable: true,
                                isOptional: true,
                                type: undefined,
                            },
                        ],
                        TypeUtils.createNumberLiteral(false, `1`),
                    ),
                ));
        });

        describe(`${Ast.NodeKind.FunctionType}`, () => {
            it(`type function`, async () => await assertParseOkNodeTypeEqual(`type function`, Type.FunctionInstance));

            it(`type function () as text`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type function () as text`,

                    TypeUtils.createFunctionType(false, [], Type.TextInstance),
                ));

            it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type function (foo as number, bar as nullable text, optional baz as date) as text`,
                    TypeUtils.createFunctionType(
                        false,
                        [
                            {
                                nameLiteral: `foo`,
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                            },
                            {
                                nameLiteral: `bar`,
                                isNullable: true,
                                isOptional: false,
                                type: Type.TypeKind.Text,
                            },
                            {
                                nameLiteral: `baz`,
                                isNullable: false,
                                isOptional: true,
                                type: Type.TypeKind.Date,
                            },
                        ],
                        Type.TextInstance,
                    ),
                ));
        });

        describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
            it(`let x = true in x`, async () =>
                await assertParseOkNodeTypeEqual(`let x = true in x`, Type.LogicalInstance));

            it(`let x = 1 in x`, async () =>
                await assertParseOkNodeTypeEqual(`let x = 1 in x`, TypeUtils.createNumberLiteral(false, `1`)));
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if true then true else false`, async () =>
                await assertParseOkNodeTypeEqual(`if true then true else false`, Type.LogicalInstance));

            it(`if true then 1 else false`, async () =>
                await assertParseOkNodeTypeEqual(
                    `if true then 1 else false`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.LogicalInstance]),
                ));

            it(`if if true then true else false then 1 else 0`, async () =>
                await assertParseOkNodeTypeEqual(
                    `if if true then true else false then 1 else ""`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), TypeUtils.createTextLiteral(false, `""`)]),
                ));

            it(`if`, async () => await assertParseErrNodeTypeEqual(`if`, Type.UnknownInstance));

            it(`if "a"`, async () => await assertParseErrNodeTypeEqual(`if "a"`, Type.NoneInstance));

            it(`if true or "a"`, async () => await assertParseErrNodeTypeEqual(`if true or "a"`, Type.NoneInstance));

            it(`if 1 as any then "a" as text else "b" as text`, async () =>
                await assertParseOkNodeTypeEqual(`if 1 as any then "a"as text else "b" as text`, Type.TextInstance));

            it(`if 1 as any then "a" else "b"`, async () =>
                await assertParseOkNodeTypeEqual(
                    `if 1 as any then "a" else "b"`,
                    anyUnion([TypeUtils.createTextLiteral(false, `"a"`), TypeUtils.createTextLiteral(false, `"b"`)]),
                ));

            it(`if true then 1`, async () =>
                await assertParseErrNodeTypeEqual(
                    `if true then 1`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.UnknownInstance]),
                ));
        });

        describe(`${Ast.NodeKind.IsExpression}`, () => {
            it(`1 is text`, async () => {
                await assertParseOkNodeTypeEqual(`1 is text`, Type.LogicalInstance);
            });
        });

        describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
            it(`1 is nullable text`, async () =>
                await assertParseOkNodeTypeEqual(`1 is nullable text`, Type.LogicalInstance));
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{1}`, async () =>
                await assertParseOkNodeTypeEqual(
                    `{1}`,
                    TypeUtils.createDefinedList(false, [TypeUtils.createNumberLiteral(false, `1`)]),
                ));

            it(`{1, ""}`, async () =>
                await assertParseOkNodeTypeEqual(
                    `{1, ""}`,
                    TypeUtils.createDefinedList(false, [
                        TypeUtils.createNumberLiteral(false, `1`),
                        TypeUtils.createTextLiteral(false, `""`),
                    ]),
                ));
        });

        describe(`${Ast.NodeKind.ListType}`, () => {
            it(`type { number }`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type { number }`,
                    TypeUtils.createListType(false, Type.NumberInstance),
                ));
        });

        describe(`${Ast.NodeKind.LiteralExpression}`, () => {
            it(`true`, async () => await assertParseOkNodeTypeEqual(`true`, Type.LogicalInstance));

            it(`false`, async () => await assertParseOkNodeTypeEqual(`false`, Type.LogicalInstance));

            it(`1`, async () => await assertParseOkNodeTypeEqual(`1`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`null`, async () => await assertParseOkNodeTypeEqual(`null`, Type.NullInstance));

            it(`{}`, async () => await assertParseOkNodeTypeEqual(`{}`, TypeUtils.createDefinedList(false, [])));

            it(`[]`, async () =>
                await assertParseOkNodeTypeEqual(`[]`, TypeUtils.createDefinedRecord(false, new Map(), false)));
        });

        describe(`${Ast.NodeKind.NullableType}`, () => {
            it(`type nullable number`, async () =>
                await assertParseOkNodeTypeEqual(`type nullable number`, Type.NullableNumberInstance));
        });

        describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
            it(`1 ?? 1`, async () =>
                await assertParseOkNodeTypeEqual(`1 ?? 1`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`1 ?? ""`, async () =>
                await assertParseOkNodeTypeEqual(`1 ?? ""`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`1 ?? (1 + "")`, async () => await assertParseOkNodeTypeEqual(`1 ?? (1 + "")`, Type.NoneInstance));
        });

        describe(`${Ast.NodeKind.Parameter}`, () => {
            it(`(foo as number) => foo|`, async () =>
                await assertParseOkScopeTypeEqual(`(foo as number) => foo|`, new Map([[`foo`, Type.NumberInstance]])));

            it(`(optional foo as number) => foo|`, async () =>
                await assertParseOkScopeTypeEqual(
                    `(optional foo as number) => foo|`,
                    new Map([[`foo`, Type.NullableNumberInstance]]),
                ));

            it(`(foo) => foo|`, async () =>
                await assertParseOkScopeTypeEqual(`(foo) => foo|`, new Map([[`foo`, Type.NullableAnyInstance]])));
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`[foo = 1] & [bar = 2]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `[foo = 1] & [bar = 2]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([
                            [`foo`, TypeUtils.createNumberLiteral(false, `1`)],
                            [`bar`, TypeUtils.createNumberLiteral(false, `2`)],
                        ]),
                        false,
                    ),
                ));

            it(`[] & [bar = 2]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `[] & [bar = 2]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([["bar", TypeUtils.createNumberLiteral(false, "2")]]),
                        false,
                    ),
                    ExtendedTestSettings,
                ));

            it(`[foo = 1] & []`, async () => {
                await assertParseOkNodeTypeEqual(
                    `[foo = 1] & []`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        false,
                    ),
                );
            });

            it(`[foo = 1] & [foo = ""]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `[foo = 1] & [foo = ""]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createTextLiteral(false, `""`)]]),
                        false,
                    ),
                ));

            it(`[] as record & [foo = 1]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `[] as record & [foo = 1]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        true,
                    ),
                ));

            it(`[foo = 1] & [] as record`, async () =>
                await assertParseOkNodeTypeEqual(
                    `[foo = 1] & [] as record`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        true,
                    ),
                ));

            it(`[] as record & [] as record`, async () =>
                await assertParseOkNodeTypeEqual(`[] as record & [] as record`, Type.RecordInstance));
        });

        describe(`${Ast.NodeKind.RecordType}`, () => {
            it(`type [foo]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type [foo]`,
                    TypeUtils.createRecordType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                ));

            it(`type [foo, ...]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type [foo, ...]`,
                    TypeUtils.createRecordType(false, new Map([[`foo`, Type.AnyInstance]]), true),
                ));

            it(`type [foo = number, bar = nullable text]`, async () => {
                await assertParseOkNodeTypeEqual(
                    `type [foo = number, bar = nullable text]`,
                    TypeUtils.createRecordType(
                        false,
                        new Map<string, Type.TPrimitiveType>([
                            [`foo`, Type.NumberInstance],
                            [`bar`, Type.NullableTextInstance],
                        ]),
                        false,
                    ),
                );
            });
        });

        describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
            describe(`any is allowed`, () => {
                it(`${Ast.NodeKind.InvokeExpression}`, async () =>
                    await assertParseOkNodeTypeEqual(`let x = (_ as any) in x()`, Type.AnyInstance));

                it(`${Ast.NodeKind.ItemAccessExpression}`, async () =>
                    await assertParseOkNodeTypeEqual(`let x = (_ as any) in x{0}`, Type.AnyInstance));

                describe(`${Ast.NodeKind.FieldSelector}`, () => {
                    it(`[a = 1][a]`, async () =>
                        await assertParseOkNodeTypeEqual(`[a = 1][a]`, TypeUtils.createNumberLiteral(false, `1`)));

                    it(`[a = 1][b]`, async () => await assertParseOkNodeTypeEqual(`[a = 1][b]`, Type.NoneInstance));

                    it(`a[b]?`, async () => await assertParseOkNodeTypeEqual(`[a = 1][b]?`, Type.NullInstance));
                });

                it(`${Ast.NodeKind.FieldProjection}`, async () =>
                    await assertParseOkNodeTypeEqual(
                        `let x = (_ as any) in x[[foo]]`,
                        anyUnion([
                            TypeUtils.createDefinedRecord(false, new Map([[`foo`, Type.AnyInstance]]), false),
                            TypeUtils.createDefinedTable(false, new PQP.OrderedMap([[`foo`, Type.AnyInstance]]), false),
                        ]),
                    ));

                it(`${Ast.NodeKind.FieldSelector}`, async () =>
                    await assertParseOkNodeTypeEqual(`[a = 1][a]`, TypeUtils.createNumberLiteral(false, `1`)));
            });

            it(`let x = () as function => () as number => 1 in x()()`, async () =>
                await assertParseOkNodeTypeEqual(
                    `let x = () as function => () as number => 1 in x()()`,
                    TypeUtils.createNumberLiteral(false, `1`),
                ));
        });

        describe(`Recursive identifiers`, () => {
            it(`let foo = 1 in [foo = foo]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `let foo = 1 in [foo = foo]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        false,
                    ),
                ));

            it(`let foo = 1 in [foo = foo, bar = foo]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `let foo = 1 in [foo = foo, bar = foo]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([
                            [`foo`, TypeUtils.createNumberLiteral(false, 1)],
                            [`bar`, TypeUtils.createNumberLiteral(false, 1)],
                        ]),
                        false,
                    ),
                ));

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
                        [`outer`, TypeUtils.createNumberLiteral(false, 2)],
                        [`inner`, TypeUtils.createNumberLiteral(false, 2)],
                    ]),
                    false,
                );

                await assertParseOkNodeTypeEqual(expression, expected);
            });
        });

        describe(`${Ast.NodeKind.TableType}`, () => {
            it(`type table [foo]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type table [foo]`,
                    TypeUtils.createTableType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                ));

            it(`type table [foo]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type table [foo]`,
                    TypeUtils.createTableType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                ));

            it(`type table [foo = number, bar = nullable text]`, async () =>
                await assertParseOkNodeTypeEqual(
                    `type table [foo = number, bar = nullable text]`,
                    TypeUtils.createTableType(
                        false,
                        new Map<string, Type.TPrimitiveType>([
                            [`foo`, Type.NumberInstance],
                            [`bar`, Type.NullableTextInstance],
                        ]),
                        false,
                    ),
                ));
        });

        describe(`${Ast.NodeKind.UnaryExpression}`, () => {
            it(`+1`, async () => await assertParseOkNodeTypeEqual(`+1`, TypeUtils.createNumberLiteral(false, `+1`)));

            it(`-1`, async () => await assertParseOkNodeTypeEqual(`-1`, TypeUtils.createNumberLiteral(false, `-1`)));

            it(`--1`, async () => await assertParseOkNodeTypeEqual(`--1`, TypeUtils.createNumberLiteral(false, `--1`)));

            it(`not true`, async () => await assertParseOkNodeTypeEqual(`not true`, Type.LogicalInstance));

            it(`not false`, async () => await assertParseOkNodeTypeEqual(`not false`, Type.LogicalInstance));

            it(`not 1`, async () => await assertParseOkNodeTypeEqual(`not 1`, Type.NoneInstance));

            it(`+true`, async () => await assertParseOkNodeTypeEqual(`+true`, Type.NoneInstance));
        });

        describe(`primitive static analysis`, () => {
            it(`${Ast.NodeKind.ListExpression}`, async () =>
                await assertParseOkNodeTypeEqual(`{1, 2}`, Type.ListInstance, PrimitiveTestSettings));

            it(`${Ast.NodeKind.ListType}`, async () =>
                await assertParseOkNodeTypeEqual(`type { foo }`, Type.TypePrimitiveInstance, PrimitiveTestSettings));

            it(`${Ast.NodeKind.RangeExpression}`, async () =>
                await assertParseOkNodeTypeEqual(`{0..1}`, Type.ListInstance, PrimitiveTestSettings));

            it(`${Ast.NodeKind.RecordExpression}`, async () =>
                await assertParseOkNodeTypeEqual(`[foo = "bar"]`, Type.RecordInstance, PrimitiveTestSettings));

            it(`${Ast.NodeKind.RecordType}`, async () =>
                await assertParseOkNodeTypeEqual(`type [foo]`, Type.TypePrimitiveInstance, PrimitiveTestSettings));

            it(`inclusve identifier`, async () =>
                await assertParseOkNodeTypeEqual(`let foo = @foo in foo`, Type.AnyInstance, PrimitiveTestSettings));
        });

        describe(`external type`, () => {
            describe(`value`, () => {
                it(`resolves to external type`, async () =>
                    await assertParseOkNodeTypeEqual(`foo`, Type.FunctionInstance));

                it(`indirect identifier resolves to external type`, async () =>
                    await assertParseOkNodeTypeEqual(`let bar = foo in bar`, Type.FunctionInstance));

                it(`fails to resolve to external type`, async () =>
                    await assertParseOkNodeTypeEqual(`bar`, Type.UnknownInstance));
            });

            describe(`invocation`, () => {
                it(`resolves with identifier`, async () =>
                    await assertParseOkNodeTypeEqual(`foo()`, Type.TextInstance));

                it(`resolves with deferenced identifier`, async () =>
                    await assertParseOkNodeTypeEqual(`let bar = foo in bar()`, Type.TextInstance));

                it(`resolves based on argument`, async () => {
                    const expression1: string = `foo()`;
                    const expected1: Type.Text = Type.TextInstance;
                    await assertParseOkNodeTypeEqual(expression1, expected1);

                    const expression2: string = `foo("bar")`;
                    const expected2: Type.Number = Type.NumberInstance;
                    await assertParseOkNodeTypeEqual(expression2, expected2);
                });
            });
        });
    });
});
