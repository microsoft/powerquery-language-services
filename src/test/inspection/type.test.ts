// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

import { ExternalType, Inspection, InspectionSettings, TypeStrategy } from "../../powerquery-language-services";
import { TestUtils } from "..";

describe(`Inspection - Type`, () => {
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

    const anyUnion: (unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType = (
        unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>,
    ) => TypeUtils.anyUnion(unionedTypePairs, NoOpTraceManagerInstance, undefined);

    async function assertEqualRootType(params: {
        readonly text: string;
        readonly expected: Type.TPowerQueryType;
        readonly settings?: InspectionSettings;
    }): Promise<void> {
        await TestUtils.assertEqualRootType({
            text: params.text,
            expected: params.expected,
            settings: params.settings ?? ExtendedInspectionSettings,
        });
    }

    async function assertEqualScopeType(textWithPipe: string, expected: Inspection.ScopeTypeByKey): Promise<void> {
        const actual: Inspection.ScopeTypeByKey = await TestUtils.assertScopeType(
            ExtendedInspectionSettings,
            textWithPipe,
        );

        TestUtils.assertEqualScopeType(expected, actual);
    }

    const ExtendedInspectionSettings: InspectionSettings = {
        ...PQP.DefaultSettings,
        isWorkspaceCacheAllowed: false,
        library: {
            externalTypeResolver: ExternalTypeResolver,
            libraryDefinitions: {
                dynamicLibraryDefinitions: () => new Map(),
                staticLibraryDefinitions: new Map(),
            },
        },
        eachScopeById: undefined,
        typeStrategy: TypeStrategy.Extended,
    };

    const PrimitiveInspectionSettings: InspectionSettings = {
        ...ExtendedInspectionSettings,
        typeStrategy: TypeStrategy.Primitive,
    };

    describe(`extended static analysis`, () => {
        describe(`BinOpExpression`, () => {
            it(`1 + 1`, async () => await assertEqualRootType({ text: `1 + 1`, expected: Type.NumberInstance }));

            it(`true and false`, async () =>
                await assertEqualRootType({ text: `true and false`, expected: Type.LogicalInstance }));

            it(`"hello" & "world"`, async () =>
                await assertEqualRootType({ text: `"hello" & "world"`, expected: Type.TextInstance }));

            it(`true + 1`, async () => await assertEqualRootType({ text: `true + 1`, expected: Type.NoneInstance }));
        });

        describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
            it(`(foo as number, bar as nullable number) => foo + bar|`, async () =>
                await assertEqualScopeType(
                    `(foo as number, bar as nullable number) => foo + bar|`,
                    new Map([
                        [`foo`, Type.NumberInstance],
                        [`#"foo"`, Type.NumberInstance],
                        [`bar`, Type.NullableNumberInstance],
                        [`#"bar"`, Type.NullableNumberInstance],
                    ]),
                ));
        });

        describe(`${Ast.NodeKind.AsExpression}`, () => {
            it(`1 as number`, async () =>
                await assertEqualRootType({ text: `1 as number`, expected: Type.NumberInstance }));

            it(`1 as text`, async () => await assertEqualRootType({ text: `1 as text`, expected: Type.TextInstance }));

            it(`1 as any`, async () => await assertEqualRootType({ text: `1 as any`, expected: Type.AnyInstance }));

            it(`1 as any`, async () =>
                await assertEqualRootType({
                    text: `1 as any`,
                    expected: Type.AnyInstance,
                }));
        });

        describe(`${Ast.NodeKind.EachExpression}`, () => {
            it(`each 1`, async () =>
                await assertEqualRootType({
                    text: `each 1`,
                    expected: TypeUtils.definedFunction(
                        false,
                        [
                            {
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Any,
                                nameLiteral: `_`,
                            },
                        ],
                        TypeUtils.numberLiteral(false, `1`),
                    ),
                }));

            describe(`each _`, () => {
                it(`without specifying eachScopeById`, async () =>
                    await assertEqualRootType({
                        text: `each _`,
                        expected: TypeUtils.definedFunction(
                            false,
                            [
                                {
                                    isNullable: false,
                                    isOptional: false,
                                    type: Type.TypeKind.Any,
                                    nameLiteral: `_`,
                                },
                            ],
                            Type.AnyInstance,
                        ),
                    }));

                it(`with specifying eachScopeById`, async () =>
                    await assertEqualRootType({
                        text: `each _`,
                        expected: TypeUtils.definedFunction(
                            false,
                            [
                                {
                                    isNullable: false,
                                    isOptional: false,
                                    type: Type.TypeKind.Any,
                                    nameLiteral: `_`,
                                },
                            ],
                            TypeUtils.numberLiteral(false, 42),
                        ),
                        settings: {
                            ...ExtendedInspectionSettings,
                            eachScopeById: new Map([[1, TypeUtils.numberLiteral(false, 42)]]),
                        },
                    }));
            });

            it(`each [foo]`, async () =>
                await assertEqualRootType({
                    text: `each [foo]`,
                    expected: TypeUtils.definedFunction(
                        false,
                        [
                            {
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Any,
                                nameLiteral: `_`,
                            },
                        ],
                        TypeUtils.numberLiteral(false, `1`),
                    ),
                    settings: {
                        ...ExtendedInspectionSettings,
                        eachScopeById: new Map([
                            [
                                1,
                                TypeUtils.definedTable(
                                    false,
                                    new PQP.OrderedMap([[`foo`, TypeUtils.numberLiteral(false, 1)]]),
                                    false,
                                ),
                            ],
                        ]),
                    },
                }));
        });

        describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
            it(`try 1`, async () =>
                await assertEqualRootType({
                    text: `try 1`,
                    expected: anyUnion([TypeUtils.numberLiteral(false, `1`), Type.RecordInstance]),
                }));

            it(`try 1 otherwise false`, async () => {
                await assertEqualRootType({
                    text: `try 1 otherwise false`,
                    expected: anyUnion([TypeUtils.numberLiteral(false, `1`), Type.LogicalInstance]),
                });
            });

            it(`try 1 otherwise`, async () =>
                await assertEqualRootType({
                    text: `try 1 otherwise`,
                    expected: anyUnion([Type.UnknownInstance, TypeUtils.numberLiteral(false, `1`)]),
                }));

            it(`try true catch () => 1)`, async () =>
                await assertEqualRootType({
                    text: `try true catch () => 1`,
                    expected: anyUnion([TypeUtils.numberLiteral(false, `1`), Type.LogicalInstance]),
                }));

            it(`try true catch`, async () =>
                await assertEqualRootType({
                    text: `try true catch`,
                    expected: anyUnion([Type.LogicalInstance, Type.UnknownInstance]),
                }));
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error 1`, async () => await assertEqualRootType({ text: `error 1`, expected: Type.AnyInstance }));
        });

        describe(`${Ast.NodeKind.FieldProjection}`, () => {
            it(`[a = 1][[a]]`, async () =>
                await assertEqualRootType({
                    text: `[a = 1][[a]]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([[`a`, TypeUtils.numberLiteral(false, `1`)]]),
                        false,
                    ),
                }));

            it(`[a = 1][[b]]`, async () =>
                await assertEqualRootType({ text: `[a = 1][[b]]`, expected: Type.NoneInstance }));

            it(`[a = 1][[b]]?`, async () =>
                await assertEqualRootType({ text: `[a = 1][[b]]?`, expected: Type.NullInstance }));

            it(`(1 as record)[[a]]`, async () =>
                await assertEqualRootType({
                    text: `let x = (1 as record) in x[[a]]`,
                    expected: TypeUtils.definedRecord(false, new Map([[`a`, Type.AnyInstance]]), false),
                }));

            it(`(1 as record)[[a]]?`, async () =>
                await assertEqualRootType({
                    text: `let x = (1 as record) in x[[a]]?`,
                    expected: TypeUtils.definedRecord(false, new Map([[`a`, Type.AnyInstance]]), false),
                }));

            it(`(each [[foo]])([foo = "bar"])`, async () =>
                await assertEqualRootType({ text: `(each [[foo]])([foo = "bar"])`, expected: Type.UnknownInstance }));

            it(`(each [[foo]])([foo = "bar", spam = "eggs"])`, async () => {
                const expression: string = `(each [[foo]])([foo = "bar", spam = "eggs"])`;

                const expectedFields: Map<string, Type.TPowerQueryType> = new Map([
                    [`foo`, TypeUtils.textLiteral(false, `"bar"`)],
                ]);

                const eachScope: Type.TPowerQueryType = TypeUtils.definedRecord(
                    false,
                    new Map([...expectedFields.entries(), [`spam`, TypeUtils.textLiteral(false, `"eggs"`)]]),
                    false,
                );

                const testSettingsWithEachScope: InspectionSettings = {
                    ...ExtendedInspectionSettings,
                    eachScopeById: new Map([[4, eachScope]]),
                };

                await assertEqualRootType({
                    text: expression,
                    expected: TypeUtils.definedRecord(false, expectedFields, false),
                    settings: testSettingsWithEachScope,
                });
            });
        });

        describe(`${Ast.NodeKind.FieldSelector}`, () => {
            it(`[a = 1][a]`, async () =>
                await assertEqualRootType({ text: `[a = 1][a]`, expected: TypeUtils.numberLiteral(false, `1`) }));

            it(`[a = 1][b]`, async () =>
                await assertEqualRootType({ text: `[a = 1][b]`, expected: Type.NoneInstance }));

            it(`[a = 1][b]?`, async () =>
                await assertEqualRootType({ text: `[a = 1][b]?`, expected: Type.NullInstance }));

            it(`let x = (1 as record) in x[a]`, async () =>
                await assertEqualRootType({ text: `let x = (1 as record) in x[a]`, expected: Type.AnyInstance }));

            it(`let x = (1 as record) in x[a]?`, async () =>
                await assertEqualRootType({ text: `let x = (1 as record) in x[a]?`, expected: Type.AnyInstance }));

            // Test for when FieldSelector is used in an EachExpression but wasn't a scope
            it(`(each [foo])([foo = "bar"])`, async () =>
                await assertEqualRootType({ text: `(each [foo])([foo = "bar"])`, expected: Type.UnknownInstance }));

            // Test for when FieldSelector is used and was given an eachScope
            it(`(each [foo])([foo = "bar"])`, async () => {
                const expression: string = `(each [foo])([foo = "bar"])`;
                const expected: Type.TPowerQueryType = TypeUtils.textLiteral(false, `"bar"`);

                const eachScope: Type.TPowerQueryType = TypeUtils.definedRecord(
                    false,
                    new Map([[`foo`, expected]]),
                    false,
                );

                const testSettingsWithEachScope: InspectionSettings = {
                    ...ExtendedInspectionSettings,
                    eachScopeById: new Map([[4, eachScope]]),
                };

                await assertEqualRootType({ text: expression, expected, settings: testSettingsWithEachScope });
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression}`, () => {
            it(`(optional x as text) => if x <> null then 1 else 2`, async () =>
                await assertEqualRootType({
                    text: `(optional x as text) => if x <> null then 1 else 2`,
                    expected: TypeUtils.definedFunction(
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
                }));

            it(`() => 1`, async () =>
                await assertEqualRootType({
                    text: `() => 1`,
                    expected: TypeUtils.definedFunction(false, [], TypeUtils.numberLiteral(false, `1`)),
                }));

            // Test AnyUnion return
            it(`() => if true then 1 else ""`, async () =>
                await assertEqualRootType({
                    text: `() => if true then 1 else ""`,
                    expected: TypeUtils.definedFunction(
                        false,
                        [],
                        anyUnion([TypeUtils.numberLiteral(false, `1`), TypeUtils.textLiteral(false, `""`)]),
                    ),
                }));

            it(`(a, b as number, c as nullable number, optional d) => 1`, async () =>
                await assertEqualRootType({
                    text: `(a, b as number, c as nullable number, optional d) => 1`,
                    expected: TypeUtils.definedFunction(
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
                        TypeUtils.numberLiteral(false, `1`),
                    ),
                }));
        });

        describe(`${Ast.NodeKind.FunctionType}`, () => {
            it(`type function`, async () =>
                await assertEqualRootType({ text: `type function`, expected: Type.FunctionInstance }));

            it(`type function () as text`, async () =>
                await assertEqualRootType({
                    text: `type function () as text`,
                    expected: TypeUtils.functionType(false, [], Type.TextInstance),
                }));

            it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, async () =>
                await assertEqualRootType({
                    text: `type function (foo as number, bar as nullable text, optional baz as date) as text`,
                    expected: TypeUtils.functionType(
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
                }));
        });

        describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
            it(`let x = true in x`, async () =>
                await assertEqualRootType({ text: `let x = true in x`, expected: Type.LogicalInstance }));

            it(`let x = 1 in x`, async () =>
                await assertEqualRootType({ text: `let x = 1 in x`, expected: TypeUtils.numberLiteral(false, `1`) }));

            it(`let _ = 1 in 1`, async () =>
                await assertEqualRootType({ text: `let _ = 1 in 1`, expected: TypeUtils.numberLiteral(false, `1`) }));
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if true then true else false`, async () =>
                await assertEqualRootType({ text: `if true then true else false`, expected: Type.LogicalInstance }));

            it(`if true then 1 else false`, async () =>
                await assertEqualRootType({
                    text: `if true then 1 else false`,
                    expected: anyUnion([TypeUtils.numberLiteral(false, `1`), Type.LogicalInstance]),
                }));

            it(`if if true then true else false then 1 else 0`, async () =>
                await assertEqualRootType({
                    text: `if if true then true else false then 1 else ""`,
                    expected: anyUnion([TypeUtils.numberLiteral(false, `1`), TypeUtils.textLiteral(false, `""`)]),
                }));

            it(`if`, async () => await assertEqualRootType({ text: `if`, expected: Type.UnknownInstance }));

            it(`if "a"`, async () => await assertEqualRootType({ text: `if "a"`, expected: Type.NoneInstance }));

            it(`if true or "a"`, async () =>
                await assertEqualRootType({ text: `if true or "a"`, expected: Type.NoneInstance }));

            it(`if 1 as any then "a" as text else "b" as text`, async () =>
                await assertEqualRootType({
                    text: `if 1 as any then "a"as text else "b" as text`,
                    expected: Type.TextInstance,
                }));

            it(`if 1 as any then "a" else "b"`, async () =>
                await assertEqualRootType({
                    text: `if 1 as any then "a" else "b"`,
                    expected: anyUnion([TypeUtils.textLiteral(false, `"a"`), TypeUtils.textLiteral(false, `"b"`)]),
                }));

            it(`if true then 1`, async () =>
                await assertEqualRootType({
                    text: `if true then 1`,
                    expected: anyUnion([TypeUtils.numberLiteral(false, `1`), Type.UnknownInstance]),
                }));
        });

        describe(`${Ast.NodeKind.IsExpression}`, () => {
            it(`1 is text`, async () => {
                await assertEqualRootType({ text: `1 is text`, expected: Type.LogicalInstance });
            });
        });

        describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
            it(`1 is nullable text`, async () =>
                await assertEqualRootType({ text: `1 is nullable text`, expected: Type.LogicalInstance }));
        });

        describe(`${Ast.NodeKind.LetExpression}`, () => {
            it(`let a = "top level" in [a = a][a]`, async () =>
                await assertEqualRootType({
                    text: `let a = "top level" in [a = a][a]`,
                    expected: TypeUtils.textLiteral(false, "top level"),
                }));
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{1}`, async () =>
                await assertEqualRootType({
                    text: `{1}`,
                    expected: TypeUtils.definedList(false, [TypeUtils.numberLiteral(false, `1`)]),
                }));

            it(`{1, ""}`, async () =>
                await assertEqualRootType({
                    text: `{1, ""}`,
                    expected: TypeUtils.definedList(false, [
                        TypeUtils.numberLiteral(false, `1`),
                        TypeUtils.textLiteral(false, `""`),
                    ]),
                }));
        });

        describe(`${Ast.NodeKind.ListType}`, () => {
            it(`type { number }`, async () =>
                await assertEqualRootType({
                    text: `type { number }`,
                    expected: TypeUtils.listType(false, Type.NumberInstance),
                }));
        });

        describe(`${Ast.NodeKind.LiteralExpression}`, () => {
            it(`true`, async () => await assertEqualRootType({ text: `true`, expected: Type.LogicalInstance }));

            it(`false`, async () => await assertEqualRootType({ text: `false`, expected: Type.LogicalInstance }));

            it(`1`, async () =>
                await assertEqualRootType({ text: `1`, expected: TypeUtils.numberLiteral(false, `1`) }));

            it(`null`, async () => await assertEqualRootType({ text: `null`, expected: Type.NullInstance }));

            it(`{}`, async () => await assertEqualRootType({ text: `{}`, expected: TypeUtils.definedList(false, []) }));

            it(`[]`, async () =>
                await assertEqualRootType({ text: `[]`, expected: TypeUtils.definedRecord(false, new Map(), false) }));
        });

        describe(`${Ast.NodeKind.NullableType}`, () => {
            it(`type nullable number`, async () =>
                await assertEqualRootType({ text: `type nullable number`, expected: Type.NullableNumberInstance }));
        });

        describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
            it(`1 ?? 1`, async () =>
                await assertEqualRootType({ text: `1 ?? 1`, expected: TypeUtils.numberLiteral(false, `1`) }));

            it(`1 ?? ""`, async () =>
                await assertEqualRootType({ text: `1 ?? ""`, expected: TypeUtils.numberLiteral(false, `1`) }));

            it(`1 ?? (1 + "")`, async () =>
                await assertEqualRootType({ text: `1 ?? (1 + "")`, expected: Type.NoneInstance }));
        });

        describe(`${Ast.NodeKind.Parameter}`, () => {
            it(`(foo as number) => foo|`, async () =>
                await assertEqualScopeType(
                    `(foo as number) => foo|`,
                    new Map([
                        [`foo`, Type.NumberInstance],
                        [`#"foo"`, Type.NumberInstance],
                    ]),
                ));

            it(`(optional foo as number) => foo|`, async () =>
                await assertEqualScopeType(
                    `(optional foo as number) => foo|`,
                    new Map([
                        [`foo`, Type.NullableNumberInstance],
                        [`#"foo"`, Type.NullableNumberInstance],
                    ]),
                ));

            it(`(foo) => foo|`, async () =>
                await assertEqualScopeType(
                    `(foo) => foo|`,
                    new Map([
                        [`foo`, Type.NullableAnyInstance],
                        [`#"foo"`, Type.NullableAnyInstance],
                    ]),
                ));
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`[foo = 1] & [bar = 2] & [with space = 3 ] & [#"unneeded quoted" = 4]`, async () =>
                await assertEqualRootType({
                    text: `[foo = 1] & [bar = 2] & [with space = 3 ] & [#"unneeded quoted" = 4]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([
                            [`foo`, TypeUtils.numberLiteral(false, `1`)],
                            [`bar`, TypeUtils.numberLiteral(false, `2`)],
                            [`with space`, TypeUtils.numberLiteral(false, `3`)],
                            [`unneeded quoted`, TypeUtils.numberLiteral(false, `4`)],
                        ]),
                        false,
                    ),
                }));

            it(`[] & [bar = 2]`, async () =>
                await assertEqualRootType({
                    text: `[] & [bar = 2]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([["bar", TypeUtils.numberLiteral(false, "2")]]),
                        false,
                    ),
                    settings: ExtendedInspectionSettings,
                }));

            it(`[foo = 1] & []`, async () => {
                await assertEqualRootType({
                    text: `[foo = 1] & []`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.numberLiteral(false, `1`)]]),
                        false,
                    ),
                });
            });

            it(`[foo = 1] & [foo = ""]`, async () =>
                await assertEqualRootType({
                    text: `[foo = 1] & [foo = ""]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.textLiteral(false, `""`)]]),
                        false,
                    ),
                }));

            it(`([] as record) & [foo = 1]`, async () =>
                await assertEqualRootType({
                    text: `([] as record) & [foo = 1]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.numberLiteral(false, `1`)]]),
                        true,
                    ),
                }));

            it(`([foo = 1]) & [] as record`, async () =>
                await assertEqualRootType({ text: `([foo = 1]) & [] as record`, expected: Type.RecordInstance }));

            it(`([] as record) & [] as record`, async () =>
                await assertEqualRootType({ text: `([] as record) & [] as record`, expected: Type.RecordInstance }));
        });

        describe(`${Ast.NodeKind.RecordType}`, () => {
            it(`type [foo]`, async () =>
                await assertEqualRootType({
                    text: `type [foo]`,
                    expected: TypeUtils.recordType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                }));

            it(`type [foo, ...]`, async () =>
                await assertEqualRootType({
                    text: `type [foo, ...]`,
                    expected: TypeUtils.recordType(false, new Map([[`foo`, Type.AnyInstance]]), true),
                }));

            it(`type [foo = number, bar = nullable text]`, async () => {
                await assertEqualRootType({
                    text: `type [foo = number, bar = nullable text]`,
                    expected: TypeUtils.recordType(
                        false,
                        new Map<string, Type.TPrimitiveType>([
                            [`foo`, Type.NumberInstance],
                            [`bar`, Type.NullableTextInstance],
                        ]),
                        false,
                    ),
                });
            });
        });

        describe(`${Ast.NodeKind.RecursivePrimaryExpression}`, () => {
            describe(`any is allowed`, () => {
                it(`${Ast.NodeKind.InvokeExpression}`, async () =>
                    await assertEqualRootType({ text: `let x = (_ as any) in x()`, expected: Type.AnyInstance }));

                it(`${Ast.NodeKind.ItemAccessExpression}`, async () =>
                    await assertEqualRootType({ text: `let x = (_ as any) in x{0}`, expected: Type.AnyInstance }));

                describe(`${Ast.NodeKind.FieldSelector}`, () => {
                    it(`[a = 1][a]`, async () =>
                        await assertEqualRootType({
                            text: `[a = 1][a]`,
                            expected: TypeUtils.numberLiteral(false, `1`),
                        }));

                    it(`[a = 1][b]`, async () =>
                        await assertEqualRootType({ text: `[a = 1][b]`, expected: Type.NoneInstance }));

                    it(`a[b]?`, async () =>
                        await assertEqualRootType({ text: `[a = 1][b]?`, expected: Type.NullInstance }));
                });

                it(`${Ast.NodeKind.FieldProjection}`, async () =>
                    await assertEqualRootType({
                        text: `let x = (_ as any) in x[[foo]]`,
                        expected: anyUnion([
                            TypeUtils.definedRecord(false, new Map([[`foo`, Type.AnyInstance]]), false),
                            TypeUtils.definedTable(false, new PQP.OrderedMap([[`foo`, Type.AnyInstance]]), false),
                        ]),
                    }));

                it(`${Ast.NodeKind.FieldSelector}`, async () =>
                    await assertEqualRootType({ text: `[a = 1][a]`, expected: TypeUtils.numberLiteral(false, `1`) }));
            });

            it(`let x = () as function => () as number => 1 in x()()`, async () =>
                await assertEqualRootType({
                    text: `let x = () as function => () as number => 1 in x()()`,
                    expected: TypeUtils.numberLiteral(false, `1`),
                }));
        });

        describe(`Recursive identifiers`, () => {
            it(`let foo = 1 in [foo = foo]`, async () =>
                await assertEqualRootType({
                    text: `let foo = 1 in [foo = foo]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.numberLiteral(false, `1`)]]),
                        false,
                    ),
                }));

            it(`let foo = 1 in [foo = foo, bar = foo]`, async () =>
                await assertEqualRootType({
                    text: `let foo = 1 in [foo = foo, bar = foo]`,
                    expected: TypeUtils.definedRecord(
                        false,
                        new Map([
                            [`foo`, TypeUtils.numberLiteral(false, 1)],
                            [`bar`, TypeUtils.numberLiteral(false, 1)],
                        ]),
                        false,
                    ),
                }));

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

                const expected: Type.DefinedRecord = TypeUtils.definedRecord(
                    false,
                    new Map([
                        [`outer`, TypeUtils.numberLiteral(false, 2)],
                        [`inner`, TypeUtils.numberLiteral(false, 2)],
                    ]),
                    false,
                );

                await assertEqualRootType({ text: expression, expected });
            });
        });

        describe(`${Ast.NodeKind.TableType}`, () => {
            it(`type table [foo]`, async () =>
                await assertEqualRootType({
                    text: `type table [foo]`,
                    expected: TypeUtils.tableType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                }));

            it(`type table [foo]`, async () =>
                await assertEqualRootType({
                    text: `type table [foo]`,
                    expected: TypeUtils.tableType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                }));

            it(`type table [foo = number, bar = nullable text]`, async () =>
                await assertEqualRootType({
                    text: `type table [foo = number, bar = nullable text]`,
                    expected: TypeUtils.tableType(
                        false,
                        new Map<string, Type.TPrimitiveType>([
                            [`foo`, Type.NumberInstance],
                            [`bar`, Type.NullableTextInstance],
                        ]),
                        false,
                    ),
                }));
        });

        describe(`${Ast.NodeKind.UnaryExpression}`, () => {
            it(`+1`, async () =>
                await assertEqualRootType({ text: `+1`, expected: TypeUtils.numberLiteral(false, `+1`) }));

            it(`-1`, async () =>
                await assertEqualRootType({ text: `-1`, expected: TypeUtils.numberLiteral(false, `-1`) }));

            it(`--1`, async () =>
                await assertEqualRootType({ text: `--1`, expected: TypeUtils.numberLiteral(false, `--1`) }));

            it(`not true`, async () => await assertEqualRootType({ text: `not true`, expected: Type.LogicalInstance }));

            it(`not false`, async () =>
                await assertEqualRootType({ text: `not false`, expected: Type.LogicalInstance }));

            it(`not 1`, async () => await assertEqualRootType({ text: `not 1`, expected: Type.NoneInstance }));

            it(`+true`, async () => await assertEqualRootType({ text: `+true`, expected: Type.NoneInstance }));
        });
    });

    describe(`primitive static analysis`, () => {
        it(`${Ast.NodeKind.ListExpression}`, async () =>
            await assertEqualRootType({
                text: `{1, 2}`,
                expected: Type.ListInstance,
                settings: PrimitiveInspectionSettings,
            }));

        it(`${Ast.NodeKind.ListType}`, async () =>
            await assertEqualRootType({
                text: `type { foo }`,
                expected: Type.TypePrimitiveInstance,
                settings: PrimitiveInspectionSettings,
            }));

        it(`${Ast.NodeKind.RangeExpression}`, async () =>
            await assertEqualRootType({
                text: `{0..1}`,
                expected: Type.ListInstance,
                settings: PrimitiveInspectionSettings,
            }));

        it(`${Ast.NodeKind.RecordExpression}`, async () =>
            await assertEqualRootType({
                text: `[foo = "bar"]`,
                expected: Type.RecordInstance,
                settings: PrimitiveInspectionSettings,
            }));

        it(`${Ast.NodeKind.RecordType}`, async () =>
            await assertEqualRootType({
                text: `type [foo]`,
                expected: Type.TypePrimitiveInstance,
                settings: PrimitiveInspectionSettings,
            }));

        it(`inclusve identifier`, async () =>
            await assertEqualRootType({
                text: `let foo = @foo in foo`,
                expected: Type.AnyInstance,
                settings: PrimitiveInspectionSettings,
            }));
    });

    describe(`external type`, () => {
        describe(`value`, () => {
            it(`resolves to external type`, async () =>
                await assertEqualRootType({ text: `foo`, expected: Type.FunctionInstance }));

            it(`indirect identifier resolves to external type`, async () =>
                await assertEqualRootType({ text: `let bar = foo in bar`, expected: Type.FunctionInstance }));

            it(`fails to resolve to external type`, async () =>
                await assertEqualRootType({ text: `bar`, expected: Type.UnknownInstance }));
        });

        describe(`invocation`, () => {
            it(`resolves with identifier`, async () =>
                await assertEqualRootType({ text: `foo()`, expected: Type.TextInstance }));

            it(`resolves with dereferenced identifier`, async () =>
                await assertEqualRootType({ text: `let bar = foo in bar()`, expected: Type.TextInstance }));

            it(`resolves based on argument`, async () => {
                const expression1: string = `foo()`;
                const expected1: Type.Text = Type.TextInstance;
                await assertEqualRootType({ text: expression1, expected: expected1 });

                const expression2: string = `foo("bar")`;
                const expected2: Type.Number = Type.NumberInstance;
                await assertEqualRootType({ text: expression2, expected: expected2 });
            });
        });
    });
});
