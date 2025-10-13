// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { describe, expect, it } from "bun:test";

import { Ast, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { type TPowerQueryType } from "@microsoft/powerquery-parser/lib/powerquery-parser/language/type/type";

import { assertEqualRootType, assertScopeType } from "../testUtils";
import { type InspectionSettings } from "../../powerquery-language-services";
import { type ScopeTypeByKey } from "../../powerquery-language-services/inspection";
import { TestConstants } from "..";
import { TestLibraryName } from "../testConstants";

describe(`dereferenceIdentifierUtils`, () => {
    async function runTypeTest(params: {
        readonly text: string;
        readonly expected: TPowerQueryType;
        readonly settings?: InspectionSettings;
    }): Promise<void> {
        await assertEqualRootType({
            text: params.text,
            expected: params.expected,
            settings: params.settings ?? TestConstants.SimpleInspectionSettings,
        });
    }

    async function runScopeTypeTest(params: {
        readonly textWithPipe: string;
        readonly expected: ScopeTypeByKey;
        readonly inspectionSettings?: InspectionSettings;
    }): Promise<void> {
        const scopeTypeByKey: ScopeTypeByKey = await assertScopeType({
            textWithPipe: params.textWithPipe,
            inspectionSettings: params.inspectionSettings ?? TestConstants.SimpleInspectionSettings,
        });

        const expectedEntries: [string, Type.TPowerQueryType][] = [...params.expected.entries()];
        const actualEntries: [string, Type.TPowerQueryType][] = [...scopeTypeByKey.entries()];

        expect(actualEntries).toEqual(expect.arrayContaining(expectedEntries));
    }

    const numberLiteral: Type.NumberLiteral = TypeUtils.numberLiteral(false, 42);

    describe(`library behavior`, () => {
        describe(`${Ast.NodeKind.LetExpression}`, () => {
            it(`happy path`, async () => {
                await runTypeTest({
                    text: `let foo = 42 in foo`,
                    expected: numberLiteral,
                });
            });

            it(`happy path with quoted identifer`, async () => {
                await runTypeTest({
                    text: `let foo = 42 in #"foo"`,
                    expected: numberLiteral,
                });
            });

            it(`multiple dereferences`, async () => {
                await runTypeTest({
                    text: `let foo = 42, bar = foo, baz = bar in baz`,
                    expected: numberLiteral,
                });
            });
        });

        describe(`${Ast.NodeKind.Parameter}`, () => {
            it(`happy path`, async () => {
                await runScopeTypeTest({
                    textWithPipe: `(foo as number) => |`,
                    expected: new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`#"foo"`, Type.NumberInstance],
                    ]),
                });
            });
        });

        describe(`${Ast.NodeKind.RecordExpression}`, () => {
            it(`happy path`, async () => {
                await runTypeTest({
                    text: `[foo = 42][foo]`,
                    expected: numberLiteral,
                });
            });

            it(`happy path with quoted identifer`, async () => {
                await runTypeTest({
                    text: `[foo = 42][#"foo"]`,
                    expected: numberLiteral,
                });
            });

            it(`happy path with generalized identifer`, async () => {
                await runTypeTest({
                    text: `[with space = 42][with space]`,
                    expected: numberLiteral,
                });
            });

            it(`multiple dereferences`, async () => {
                await runTypeTest({
                    text: `[foo = 42, bar = foo, baz = bar][baz]`,
                    expected: numberLiteral,
                });
            });
        });

        describe(`${Ast.NodeKind.SectionMember}`, () => {
            it(`happy path`, async () => {
                await runScopeTypeTest({
                    textWithPipe: `section Document1; foo = 42; bar = |`,
                    expected: new Map<string, Type.TPowerQueryType>([
                        [`foo`, numberLiteral],
                        [`@foo`, numberLiteral],
                        [`#"foo"`, numberLiteral],
                        [`@#"foo"`, numberLiteral],
                        [`@bar`, Type.UnknownInstance],
                        [`@#"bar"`, Type.UnknownInstance],
                    ]),
                });
            });

            it(`happy path with quoted identifer`, async () => {
                await runScopeTypeTest({
                    textWithPipe: `section Document1; foo = 42; bar = #"foo"; baz = |`,
                    expected: new Map<string, Type.TPowerQueryType>([
                        [`foo`, numberLiteral],
                        [`@foo`, numberLiteral],
                        [`#"foo"`, numberLiteral],
                        [`@#"foo"`, numberLiteral],
                        [`bar`, numberLiteral],
                        [`@bar`, numberLiteral],
                        [`#"bar"`, numberLiteral],
                        [`@#"bar"`, numberLiteral],
                        [`@baz`, Type.UnknownInstance],
                        [`@#"baz"`, Type.UnknownInstance],
                    ]),
                });
            });
        });
    });

    describe(`library behavior`, () => {
        it(`happy path`, async () => {
            await runTypeTest({
                text: `${TestLibraryName.Number}`,
                expected: Type.NumberInstance,
            });
        });

        it(`allow '@' prefix`, async () => {
            await runTypeTest({
                text: `@${TestLibraryName.Number}`,
                expected: Type.NumberInstance,
            });
        });

        it(`allow quoted identifier`, async () => {
            await runTypeTest({
                text: `#"${TestLibraryName.Number}"`,
                expected: Type.NumberInstance,
            });
        });

        it(`allow '@' prefix and quoted identifier`, async () => {
            await runTypeTest({
                text: `@#"${TestLibraryName.Number}"`,
                expected: Type.NumberInstance,
            });
        });

        it(`multiple dereferences`, async () => {
            await runTypeTest({
                text: `let foo = ${TestLibraryName.Number}, bar = foo, baz = bar in baz`,
                expected: Type.NumberInstance,
            });
        });
    });
});
