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
    ) => TypeUtils.createAnyUnion(unionedTypePairs, NoOpTraceManagerInstance, undefined);

    async function assertEqualRootType(
        text: string,
        expected: Type.TPowerQueryType,
        settings: InspectionSettings = ExtendedInspectionSettings,
    ): Promise<void> {
        await TestUtils.assertEqualRootType(text, expected, settings);
    }

    async function assertEqualScopeType(textWithPipe: string, expected: Inspection.ScopeTypeByKey): Promise<void> {
        await TestUtils.assertEqualScopeType(textWithPipe, expected, ExtendedInspectionSettings);
    }

    const ExtendedInspectionSettings: InspectionSettings = {
        ...PQP.DefaultSettings,
        isWorkspaceCacheAllowed: false,
        library: {
            externalTypeResolver: ExternalTypeResolver,
            libraryDefinitions: new Map(),
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
            it(`1 + 1`, async () => await assertEqualRootType(`1 + 1`, Type.NumberInstance));

            it(`true and false`, async () => await assertEqualRootType(`true and false`, Type.LogicalInstance));

            it(`"hello" & "world"`, async () => await assertEqualRootType(`"hello" & "world"`, Type.TextInstance));

            it(`true + 1`, async () => await assertEqualRootType(`true + 1`, Type.NoneInstance));
        });

        describe(`${Ast.NodeKind.AsNullablePrimitiveType}`, () => {
            it(`(foo as number, bar as nullable number) => foo + bar|`, async () =>
                await assertEqualScopeType(
                    `(foo as number, bar as nullable number) => foo + bar|`,
                    new Map([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableNumberInstance],
                    ]),
                ));
        });

        describe(`${Ast.NodeKind.AsExpression}`, () => {
            it(`1 as number`, async () => await assertEqualRootType(`1 as number`, Type.NumberInstance));

            it(`1 as text`, async () => await assertEqualRootType(`1 as text`, Type.TextInstance));

            it(`1 as any`, async () => await assertEqualRootType(`1 as any`, Type.AnyInstance));
        });

        describe(`${Ast.NodeKind.EachExpression}`, () => {
            it(`each 1`, async () =>
                await assertEqualRootType(
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
                await assertEqualRootType(
                    `try 1`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.RecordInstance]),
                ));

            it(`try 1 otherwise false`, async () => {
                await assertEqualRootType(
                    `try 1 otherwise false`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.LogicalInstance]),
                );
            });

            it(`try 1 otherwise`, async () =>
                await assertEqualRootType(
                    `try 1 otherwise`,
                    anyUnion([Type.UnknownInstance, TypeUtils.createNumberLiteral(false, `1`)]),
                ));

            it(`try true catch () => 1)`, async () =>
                await assertEqualRootType(
                    `try true catch () => 1`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.LogicalInstance]),
                ));

            it(`try true catch`, async () =>
                await assertEqualRootType(`try true catch`, anyUnion([Type.LogicalInstance, Type.UnknownInstance])));
        });

        describe(`${Ast.NodeKind.ErrorRaisingExpression}`, () => {
            it(`error 1`, async () => await assertEqualRootType(`error 1`, Type.AnyInstance));
        });

        describe(`${Ast.NodeKind.FieldProjection}`, () => {
            it(`[a = 1][[a]]`, async () =>
                await assertEqualRootType(
                    `[a = 1][[a]]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`a`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        false,
                    ),
                ));

            it(`[a = 1][[b]]`, async () => await assertEqualRootType(`[a = 1][[b]]`, Type.NoneInstance));

            it(`[a = 1][[b]]?`, async () => await assertEqualRootType(`[a = 1][[b]]?`, Type.NullInstance));

            it(`(1 as record)[[a]]`, async () =>
                await assertEqualRootType(
                    `let x = (1 as record) in x[[a]]`,
                    TypeUtils.createDefinedRecord(false, new Map([[`a`, Type.AnyInstance]]), false),
                ));

            it(`(1 as record)[[a]]?`, async () =>
                await assertEqualRootType(
                    `let x = (1 as record) in x[[a]]?`,
                    TypeUtils.createDefinedRecord(false, new Map([[`a`, Type.AnyInstance]]), false),
                ));

            it(`(each [[foo]])([foo = "bar"])`, async () =>
                await assertEqualRootType(`(each [[foo]])([foo = "bar"])`, Type.UnknownInstance));

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
                    ...ExtendedInspectionSettings,
                    eachScopeById: new Map([[5, eachScope]]),
                };

                await assertEqualRootType(
                    expression,
                    TypeUtils.createDefinedRecord(false, expectedFields, false),
                    testSettingsWithEachScope,
                );
            });
        });

        describe(`${Ast.NodeKind.FieldSelector}`, () => {
            it(`[a = 1][a]`, async () =>
                await assertEqualRootType(`[a = 1][a]`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`[a = 1][b]`, async () => await assertEqualRootType(`[a = 1][b]`, Type.NoneInstance));

            it(`[a = 1][b]?`, async () => await assertEqualRootType(`[a = 1][b]?`, Type.NullInstance));

            it(`let x = (1 as record) in x[a]`, async () =>
                await assertEqualRootType(`let x = (1 as record) in x[a]`, Type.AnyInstance));

            it(`let x = (1 as record) in x[a]?`, async () =>
                await assertEqualRootType(`let x = (1 as record) in x[a]?`, Type.AnyInstance));

            // Test for when FieldSelector is used in an EachExpression but wasn't a scope
            it(`(each [foo])([foo = "bar"])`, async () =>
                await assertEqualRootType(`(each [foo])([foo = "bar"])`, Type.UnknownInstance));

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
                    ...ExtendedInspectionSettings,
                    eachScopeById: new Map([[5, eachScope]]),
                };

                await assertEqualRootType(expression, expected, testSettingsWithEachScope);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression}`, () => {
            it(`(optional x as text) => if x <> null then 1 else 2`, async () =>
                await assertEqualRootType(
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
                await assertEqualRootType(
                    `() => 1`,
                    TypeUtils.createDefinedFunction(false, [], TypeUtils.createNumberLiteral(false, `1`)),
                ));

            // Test AnyUnion return
            it(`() => if true then 1 else ""`, async () =>
                await assertEqualRootType(
                    `() => if true then 1 else ""`,
                    TypeUtils.createDefinedFunction(
                        false,
                        [],
                        anyUnion([TypeUtils.createNumberLiteral(false, `1`), TypeUtils.createTextLiteral(false, `""`)]),
                    ),
                ));

            it(`(a, b as number, c as nullable number, optional d) => 1`, async () =>
                await assertEqualRootType(
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
            it(`type function`, async () => await assertEqualRootType(`type function`, Type.FunctionInstance));

            it(`type function () as text`, async () =>
                await assertEqualRootType(
                    `type function () as text`,

                    TypeUtils.createFunctionType(false, [], Type.TextInstance),
                ));

            it(`type function (foo as number, bar as nullable text, optional baz as date) as text`, async () =>
                await assertEqualRootType(
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
            it(`let x = true in x`, async () => await assertEqualRootType(`let x = true in x`, Type.LogicalInstance));

            it(`let x = 1 in x`, async () =>
                await assertEqualRootType(`let x = 1 in x`, TypeUtils.createNumberLiteral(false, `1`)));
        });

        describe(`${Ast.NodeKind.IfExpression}`, () => {
            it(`if true then true else false`, async () =>
                await assertEqualRootType(`if true then true else false`, Type.LogicalInstance));

            it(`if true then 1 else false`, async () =>
                await assertEqualRootType(
                    `if true then 1 else false`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.LogicalInstance]),
                ));

            it(`if if true then true else false then 1 else 0`, async () =>
                await assertEqualRootType(
                    `if if true then true else false then 1 else ""`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), TypeUtils.createTextLiteral(false, `""`)]),
                ));

            it(`if`, async () => await assertEqualRootType(`if`, Type.UnknownInstance));

            it(`if "a"`, async () => await assertEqualRootType(`if "a"`, Type.NoneInstance));

            it(`if true or "a"`, async () => await assertEqualRootType(`if true or "a"`, Type.NoneInstance));

            it(`if 1 as any then "a" as text else "b" as text`, async () =>
                await assertEqualRootType(`if 1 as any then "a"as text else "b" as text`, Type.TextInstance));

            it(`if 1 as any then "a" else "b"`, async () =>
                await assertEqualRootType(
                    `if 1 as any then "a" else "b"`,
                    anyUnion([TypeUtils.createTextLiteral(false, `"a"`), TypeUtils.createTextLiteral(false, `"b"`)]),
                ));

            it(`if true then 1`, async () =>
                await assertEqualRootType(
                    `if true then 1`,
                    anyUnion([TypeUtils.createNumberLiteral(false, `1`), Type.UnknownInstance]),
                ));
        });

        describe(`${Ast.NodeKind.IsExpression}`, () => {
            it(`1 is text`, async () => {
                await assertEqualRootType(`1 is text`, Type.LogicalInstance);
            });
        });

        describe(`${Ast.NodeKind.IsNullablePrimitiveType}`, () => {
            it(`1 is nullable text`, async () => await assertEqualRootType(`1 is nullable text`, Type.LogicalInstance));
        });

        describe(`${Ast.NodeKind.ListExpression}`, () => {
            it(`{1}`, async () =>
                await assertEqualRootType(
                    `{1}`,
                    TypeUtils.createDefinedList(false, [TypeUtils.createNumberLiteral(false, `1`)]),
                ));

            it(`{1, ""}`, async () =>
                await assertEqualRootType(
                    `{1, ""}`,
                    TypeUtils.createDefinedList(false, [
                        TypeUtils.createNumberLiteral(false, `1`),
                        TypeUtils.createTextLiteral(false, `""`),
                    ]),
                ));
        });

        describe(`${Ast.NodeKind.ListType}`, () => {
            it(`type { number }`, async () =>
                await assertEqualRootType(`type { number }`, TypeUtils.createListType(false, Type.NumberInstance)));
        });

        describe(`${Ast.NodeKind.LiteralExpression}`, () => {
            it(`true`, async () => await assertEqualRootType(`true`, Type.LogicalInstance));

            it(`false`, async () => await assertEqualRootType(`false`, Type.LogicalInstance));

            it(`1`, async () => await assertEqualRootType(`1`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`null`, async () => await assertEqualRootType(`null`, Type.NullInstance));

            it(`{}`, async () => await assertEqualRootType(`{}`, TypeUtils.createDefinedList(false, [])));

            it(`[]`, async () =>
                await assertEqualRootType(`[]`, TypeUtils.createDefinedRecord(false, new Map(), false)));
        });

        describe(`${Ast.NodeKind.NullableType}`, () => {
            it(`type nullable number`, async () =>
                await assertEqualRootType(`type nullable number`, Type.NullableNumberInstance));
        });

        describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
            it(`1 ?? 1`, async () => await assertEqualRootType(`1 ?? 1`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`1 ?? ""`, async () => await assertEqualRootType(`1 ?? ""`, TypeUtils.createNumberLiteral(false, `1`)));

            it(`1 ?? (1 + "")`, async () => await assertEqualRootType(`1 ?? (1 + "")`, Type.NoneInstance));
        });

        describe(`${Ast.NodeKind.Parameter}`, () => {
            it(`(foo as number) => foo|`, async () =>
                await assertEqualScopeType(`(foo as number) => foo|`, new Map([[`foo`, Type.NumberInstance]])));

            it(`(optional foo as number) => foo|`, async () =>
                await assertEqualScopeType(
                    `(optional foo as number) => foo|`,
                    new Map([[`foo`, Type.NullableNumberInstance]]),
                ));

            it(`(foo) => foo|`, async () =>
                await assertEqualScopeType(`(foo) => foo|`, new Map([[`foo`, Type.NullableAnyInstance]])));
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`[foo = 1] & [bar = 2]`, async () =>
                await assertEqualRootType(
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
                await assertEqualRootType(
                    `[] & [bar = 2]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([["bar", TypeUtils.createNumberLiteral(false, "2")]]),
                        false,
                    ),
                    ExtendedInspectionSettings,
                ));

            it(`[foo = 1] & []`, async () => {
                await assertEqualRootType(
                    `[foo = 1] & []`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        false,
                    ),
                );
            });

            it(`[foo = 1] & [foo = ""]`, async () =>
                await assertEqualRootType(
                    `[foo = 1] & [foo = ""]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createTextLiteral(false, `""`)]]),
                        false,
                    ),
                ));

            it(`[] as record & [foo = 1]`, async () =>
                await assertEqualRootType(
                    `[] as record & [foo = 1]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        true,
                    ),
                ));

            it(`[foo = 1] & [] as record`, async () =>
                await assertEqualRootType(
                    `[foo = 1] & [] as record`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        true,
                    ),
                ));

            it(`[] as record & [] as record`, async () =>
                await assertEqualRootType(`[] as record & [] as record`, Type.RecordInstance));
        });

        describe(`${Ast.NodeKind.RecordType}`, () => {
            it(`type [foo]`, async () =>
                await assertEqualRootType(
                    `type [foo]`,
                    TypeUtils.createRecordType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                ));

            it(`type [foo, ...]`, async () =>
                await assertEqualRootType(
                    `type [foo, ...]`,
                    TypeUtils.createRecordType(false, new Map([[`foo`, Type.AnyInstance]]), true),
                ));

            it(`type [foo = number, bar = nullable text]`, async () => {
                await assertEqualRootType(
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
                    await assertEqualRootType(`let x = (_ as any) in x()`, Type.AnyInstance));

                it(`${Ast.NodeKind.ItemAccessExpression}`, async () =>
                    await assertEqualRootType(`let x = (_ as any) in x{0}`, Type.AnyInstance));

                describe(`${Ast.NodeKind.FieldSelector}`, () => {
                    it(`[a = 1][a]`, async () =>
                        await assertEqualRootType(`[a = 1][a]`, TypeUtils.createNumberLiteral(false, `1`)));

                    it(`[a = 1][b]`, async () => await assertEqualRootType(`[a = 1][b]`, Type.NoneInstance));

                    it(`a[b]?`, async () => await assertEqualRootType(`[a = 1][b]?`, Type.NullInstance));
                });

                it(`${Ast.NodeKind.FieldProjection}`, async () =>
                    await assertEqualRootType(
                        `let x = (_ as any) in x[[foo]]`,
                        anyUnion([
                            TypeUtils.createDefinedRecord(false, new Map([[`foo`, Type.AnyInstance]]), false),
                            TypeUtils.createDefinedTable(false, new PQP.OrderedMap([[`foo`, Type.AnyInstance]]), false),
                        ]),
                    ));

                it(`${Ast.NodeKind.FieldSelector}`, async () =>
                    await assertEqualRootType(`[a = 1][a]`, TypeUtils.createNumberLiteral(false, `1`)));
            });

            it(`let x = () as function => () as number => 1 in x()()`, async () =>
                await assertEqualRootType(
                    `let x = () as function => () as number => 1 in x()()`,
                    TypeUtils.createNumberLiteral(false, `1`),
                ));
        });

        describe(`Recursive identifiers`, () => {
            it(`let foo = 1 in [foo = foo]`, async () =>
                await assertEqualRootType(
                    `let foo = 1 in [foo = foo]`,
                    TypeUtils.createDefinedRecord(
                        false,
                        new Map([[`foo`, TypeUtils.createNumberLiteral(false, `1`)]]),
                        false,
                    ),
                ));

            it(`let foo = 1 in [foo = foo, bar = foo]`, async () =>
                await assertEqualRootType(
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

                await assertEqualRootType(expression, expected);
            });
        });

        describe(`${Ast.NodeKind.TableType}`, () => {
            it(`type table [foo]`, async () =>
                await assertEqualRootType(
                    `type table [foo]`,
                    TypeUtils.createTableType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                ));

            it(`type table [foo]`, async () =>
                await assertEqualRootType(
                    `type table [foo]`,
                    TypeUtils.createTableType(false, new Map([[`foo`, Type.AnyInstance]]), false),
                ));

            it(`type table [foo = number, bar = nullable text]`, async () =>
                await assertEqualRootType(
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
            it(`+1`, async () => await assertEqualRootType(`+1`, TypeUtils.createNumberLiteral(false, `+1`)));

            it(`-1`, async () => await assertEqualRootType(`-1`, TypeUtils.createNumberLiteral(false, `-1`)));

            it(`--1`, async () => await assertEqualRootType(`--1`, TypeUtils.createNumberLiteral(false, `--1`)));

            it(`not true`, async () => await assertEqualRootType(`not true`, Type.LogicalInstance));

            it(`not false`, async () => await assertEqualRootType(`not false`, Type.LogicalInstance));

            it(`not 1`, async () => await assertEqualRootType(`not 1`, Type.NoneInstance));

            it(`+true`, async () => await assertEqualRootType(`+true`, Type.NoneInstance));
        });

        describe(`primitive static analysis`, () => {
            it(`${Ast.NodeKind.ListExpression}`, async () =>
                await assertEqualRootType(`{1, 2}`, Type.ListInstance, PrimitiveInspectionSettings));

            it(`${Ast.NodeKind.ListType}`, async () =>
                await assertEqualRootType(`type { foo }`, Type.TypePrimitiveInstance, PrimitiveInspectionSettings));

            it(`${Ast.NodeKind.RangeExpression}`, async () =>
                await assertEqualRootType(`{0..1}`, Type.ListInstance, PrimitiveInspectionSettings));

            it(`${Ast.NodeKind.RecordExpression}`, async () =>
                await assertEqualRootType(`[foo = "bar"]`, Type.RecordInstance, PrimitiveInspectionSettings));

            it(`${Ast.NodeKind.RecordType}`, async () =>
                await assertEqualRootType(`type [foo]`, Type.TypePrimitiveInstance, PrimitiveInspectionSettings));

            it(`inclusve identifier`, async () =>
                await assertEqualRootType(`let foo = @foo in foo`, Type.AnyInstance, PrimitiveInspectionSettings));
        });

        describe(`external type`, () => {
            describe(`value`, () => {
                it(`resolves to external type`, async () => await assertEqualRootType(`foo`, Type.FunctionInstance));

                it(`indirect identifier resolves to external type`, async () =>
                    await assertEqualRootType(`let bar = foo in bar`, Type.FunctionInstance));

                it(`fails to resolve to external type`, async () =>
                    await assertEqualRootType(`bar`, Type.UnknownInstance));
            });

            describe(`invocation`, () => {
                it(`resolves with identifier`, async () => await assertEqualRootType(`foo()`, Type.TextInstance));

                it(`resolves with deferenced identifier`, async () =>
                    await assertEqualRootType(`let bar = foo in bar()`, Type.TextInstance));

                it(`resolves based on argument`, async () => {
                    const expression1: string = `foo()`;
                    const expected1: Type.Text = Type.TextInstance;
                    await assertEqualRootType(expression1, expected1);

                    const expression2: string = `foo("bar")`;
                    const expected2: Type.Number = Type.NumberInstance;
                    await assertEqualRootType(expression2, expected2);
                });
            });
        });
    });
});
