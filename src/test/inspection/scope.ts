// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import type { Position } from "vscode-languageserver-types";

import { Inspection, InspectionSettings, Library, TypeStrategy } from "../../powerquery-language-services";
import { assertGetNodeScope } from "../testUtils";
import { TestUtils } from "..";

export type TAbridgedNodeScopeItem =
    | AbridgedEachScopeItem
    | AbridgedLetVariableScopeItem
    | AbridgedParameterScopeItem
    | AbridgedRecordScopeItem
    | AbridgedSectionMemberScopeItem
    | AbridgedUndefinedScopeItem;

const DefaultSettings: InspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: false,
    eachScopeById: undefined,
    library: Library.NoOpLibrary,
    typeStrategy: TypeStrategy.Extended,
};

interface IAbridgedNodeScopeItem {
    readonly identifier: string;
    readonly isRecursive: boolean;
    readonly kind: Inspection.ScopeItemKind;
}

interface AbridgedEachScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.Each;
    readonly eachExpressionNodeId: number;
}

interface AbridgedLetVariableScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.LetVariable;
    readonly keyNodeId: number;
    readonly valueNodeId: number | undefined;
}

interface AbridgedParameterScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.Parameter;
    readonly isNullable: boolean;
    readonly isOptional: boolean;
    readonly type: Constant.PrimitiveTypeConstant | undefined;
}

interface AbridgedRecordScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.RecordField;
    readonly keyNodeId: number;
    readonly valueNodeId: number | undefined;
}

interface AbridgedSectionMemberScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.SectionMember;
    readonly keyNodeId: number;
    readonly valueNodeId: number | undefined;
}

interface AbridgedUndefinedScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: Inspection.ScopeItemKind.Undefined;
    readonly nodeId: number;
}

function createAbridgedNodeScopeItem(identifier: string, scopeItem: Inspection.TScopeItem): TAbridgedNodeScopeItem {
    switch (scopeItem.kind) {
        case Inspection.ScopeItemKind.LetVariable:
        case Inspection.ScopeItemKind.RecordField:
        case Inspection.ScopeItemKind.SectionMember:
            return {
                identifier,
                isRecursive: scopeItem.isRecursive,
                kind: scopeItem.kind,
                keyNodeId: scopeItem.key.id,
                valueNodeId: scopeItem.value?.node.id,
            };

        case Inspection.ScopeItemKind.Each:
            return {
                identifier,
                isRecursive: scopeItem.isRecursive,
                kind: scopeItem.kind,
                eachExpressionNodeId: scopeItem.eachExpression.node.id,
            };

        case Inspection.ScopeItemKind.Parameter:
            return {
                identifier,
                isRecursive: scopeItem.isRecursive,
                kind: scopeItem.kind,
                isNullable: scopeItem.isNullable,
                isOptional: scopeItem.isOptional,
                type: scopeItem.type,
            };

        case Inspection.ScopeItemKind.Undefined:
            return {
                identifier,
                isRecursive: scopeItem.isRecursive,
                kind: scopeItem.kind,
                nodeId: scopeItem.xorNode.node.id,
            };

        default:
            throw Assert.isNever(scopeItem);
    }
}

function createAbridgedNodeScopeItems(nodeScope: Inspection.NodeScope): ReadonlyArray<TAbridgedNodeScopeItem> {
    const result: TAbridgedNodeScopeItem[] = [];

    for (const [identifier, scopeItem] of nodeScope.entries()) {
        result.push(createAbridgedNodeScopeItem(identifier, scopeItem));
    }

    return result;
}

async function assertNodeScope(textWithPipe: string, expected: ReadonlyArray<TAbridgedNodeScopeItem>): Promise<void> {
    const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(textWithPipe);

    const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
        await assertGetNodeScope(DefaultSettings, text, position),
    );

    expect(actual).to.deep.equal(expected);
}

describe(`subset Inspection - Scope - Identifier`, () => {
    describe(`Scope`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
            it(`|each 1`, async () => await assertNodeScope(`|each 1`, []));

            it(`each| 1`, async () => await assertNodeScope(`each| 1`, []));

            it(`each |1`, async () =>
                await assertNodeScope(`each |1`, [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 1,
                    },
                ]));

            it(`each 1|`, async () =>
                await assertNodeScope(`each 1|`, [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 1,
                    },
                ]));

            it(`each each 1|`, async () =>
                await assertNodeScope(`each each 1|`, [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 3,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
            it(`each|`, async () => await assertNodeScope(`each|`, []));

            it(`each |`, async () =>
                await assertNodeScope(`each |`, [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 1,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, async () => await assertNodeScope(`|(x) => z`, []));

            it(`(x|, y) => z`, async () => await assertNodeScope(`(x|, y) => z`, []));

            it(`(x, y)| => z`, async () => await assertNodeScope(`(x, y)| => z`, []));

            it(`(x, y) => z|`, async () =>
                await assertNodeScope(`(x, y) => z|`, [
                    {
                        identifier: "x",
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
                ]));
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, async () => await assertNodeScope(`|(x) =>`, []));

            it(`(x|, y) =>`, async () => await assertNodeScope(`(x|, y) =>`, []));

            it(`(x, y)| =>`, async () => await assertNodeScope(`(x, y)| =>`, []));

            it(`(x, y) =>|`, async () =>
                await assertNodeScope(`(x, y) =>|`, [
                    {
                        identifier: "x",
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
                ]));
        });

        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`let x = 1, y = x in 1|`, async () =>
                await assertNodeScope(`let x = 1, y = x in 1|`, [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                    {
                        identifier: "y",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 14,
                        valueNodeId: 18,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[a=1]`, async () => await assertNodeScope(`|[a=1]`, []));

            it(`[|a=1]`, async () => await assertNodeScope(`[|a=1]`, []));

            it(`[a=1|]`, async () =>
                await assertNodeScope(`[a=1|]`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ]));

            it(`[a=1, b=2|]`, async () =>
                await assertNodeScope(`[a=1, b=2|]`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@b",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                ]));

            it(`[a=1, b=2|, c=3]`, async () =>
                await assertNodeScope(`[a=1, b=2|, c=3]`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@b",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                    {
                        identifier: "c",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: false,
                        keyNodeId: 24,
                        valueNodeId: 28,
                    },
                ]));

            it(`[a=1]|`, async () => await assertNodeScope(`[a=1]|`, []));

            it(`[a=[|b=1]]`, async () =>
                await assertNodeScope(`[a=[|b=1]]`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[a=1`, async () => await assertNodeScope(`|[a=1`, []));

            it(`[|a=1`, async () => await assertNodeScope(`[|a=1`, []));

            it(`[a=|1`, async () =>
                await assertNodeScope(`[a=|1`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ]));

            it(`[a=1|`, async () => {
                await assertNodeScope(`[a=1|`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ]);
            });

            it(`[a=1, b=|`, async () =>
                await assertNodeScope(`[a=1, b=|`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@b",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 18,
                    },
                ]));

            it(`[a=1, b=2|, c=3`, async () =>
                await assertNodeScope(`[a=1, b=2|, c=3`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@b",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                    {
                        identifier: "c",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: false,
                        keyNodeId: 24,
                        valueNodeId: 28,
                    },
                ]));

            it(`[a=[|b=1`, async () =>
                await assertNodeScope(`[a=[|b=1`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 10,
                    },
                ]));

            it(`[a=[b=|`, async () =>
                await assertNodeScope(`[a=[b=|`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 10,
                    },
                    {
                        identifier: "@b",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 17,
                        valueNodeId: 19,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.Section} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, async () => await assertNodeScope(`s|ection foo; x = 1; y = 2;`, []));

            it(`section foo; x = 1|; y = 2;`, async () =>
                await assertNodeScope(`section foo; x = 1|; y = 2;`, [
                    {
                        identifier: "@x",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "y",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                ]));

            it(`section foo; x = 1; y = 2|;`, async () =>
                await assertNodeScope(`section foo; x = 1; y = 2|;`, [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@y",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                ]));

            it(`section foo; x = 1; y = 2;|`, async () => await assertNodeScope(`section foo; x = 1; y = 2;|`, []));

            it(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, async () =>
                await assertNodeScope(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "y",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                    {
                        identifier: "@z",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: true,
                        keyNodeId: 24,
                        valueNodeId: 26,
                    },
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 31,
                        valueNodeId: 35,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            it(`s|ection foo; x = 1; y = 2`, async () => await assertNodeScope(`s|ection foo; x = 1; y = 2`, []));

            it(`section foo; x = 1|; y = 2`, async () =>
                await assertNodeScope(`section foo; x = 1|; y = 2`, [
                    {
                        identifier: "@x",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "y",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                ]));

            it(`section foo; x = 1; y = 2|`, async () =>
                await assertNodeScope(`section foo; x = 1; y = 2|`, [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@y",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 20,
                    },
                ]));

            it(`section foo; x = 1; y = () => 10|`, async () =>
                await assertNodeScope(`section foo; x = 1; y = () => 10|`, [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: false,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                    {
                        identifier: "@y",
                        kind: Inspection.ScopeItemKind.SectionMember,
                        isRecursive: true,
                        keyNodeId: 16,
                        valueNodeId: 18,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1 in |x`, async () =>
                await assertNodeScope(`let a = 1 in |x`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ]));

            it(`let a = 1 in x|`, async () =>
                await assertNodeScope(`let a = 1 in x|`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ]));

            it(`let a = |1 in x`, async () =>
                await assertNodeScope(`let a = |1 in x`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: true,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ]));

            it(`let a = 1, b = 2 in x|`, async () =>
                await assertNodeScope(`let a = 1, b = 2 in x|`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                    {
                        identifier: "b",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 14,
                        valueNodeId: 18,
                    },
                ]));

            it(`let a = 1|, b = 2 in x`, async () =>
                await assertNodeScope(`let a = 1|, b = 2 in x`, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: true,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                    {
                        identifier: "b",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 14,
                        valueNodeId: 18,
                    },
                ]));

            it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, async () =>
                await assertNodeScope(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, [
                    {
                        identifier: "p1",
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
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 19,
                        valueNodeId: 23,
                    },
                    {
                        identifier: "b",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 27,
                        valueNodeId: 31,
                    },
                    {
                        identifier: "@c",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: true,
                        keyNodeId: 35,
                        valueNodeId: 39,
                    },
                ]));

            it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, async () =>
                await assertNodeScope(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, [
                    {
                        identifier: "eggs",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 8,
                    },
                    {
                        identifier: "foo",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 25,
                        valueNodeId: 29,
                    },
                    {
                        identifier: "bar",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 33,
                        valueNodeId: 37,
                    },
                ]));

            it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, async () =>
                await assertNodeScope(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, [
                    {
                        identifier: "@eggs",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: true,
                        keyNodeId: 6,
                        valueNodeId: 8,
                    },
                    {
                        identifier: "foo",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 25,
                        valueNodeId: 29,
                    },
                    {
                        identifier: "bar",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 33,
                        valueNodeId: 37,
                    },
                    {
                        identifier: "ham",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 13,
                        valueNodeId: 17,
                    },
                ]));
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1 in |`, async () =>
                await assertNodeScope(`let a = 1 in |`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ]));

            it(`let a = 1, b = 2 in |`, async () =>
                await assertNodeScope(`let a = 1, b = 2 in |`, [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                    {
                        identifier: "b",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 14,
                        valueNodeId: 18,
                    },
                ]));

            it(`let a = 1|, b = 2 in`, async () =>
                await assertNodeScope(`let a = 1|, b = 2 in `, [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: true,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                    {
                        identifier: "b",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 14,
                        valueNodeId: 18,
                    },
                ]));

            it(`let x = (let y = 1 in z|) in`, async () =>
                await assertNodeScope(`let x = (let y = 1 in z|) in`, [
                    {
                        identifier: "@x",
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
                        valueNodeId: 20,
                    },
                ]));

            it(`let x = (let y = 1 in z) in |`, async () =>
                await assertNodeScope(`let x = (let y = 1 in z) in |`, [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 9,
                    },
                ]));

            it(`an EachExpression contains the parent's scope;`, async () =>
                await assertNodeScope(
                    `let
                        tbl = 1 as table,
                        bar = "bar"
                    in
                        each |`,
                    [
                        {
                            identifier: "tbl",
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
                            valueNodeId: 21,
                        },
                        {
                            eachExpressionNodeId: 23,
                            identifier: "_",
                            isRecursive: false,
                            kind: Inspection.ScopeItemKind.Each,
                        },
                    ],
                ));
        });

        describe(`generalized expression`, () => {
            it(`let #"x" = 1 in x`, async () =>
                await assertNodeScope(`let #"x" = 1 in x|`, [
                    {
                        identifier: `x`,
                        isRecursive: false,
                        keyNodeId: 6,
                        kind: Inspection.ScopeItemKind.LetVariable,
                        valueNodeId: 10,
                    },
                    {
                        identifier: `#"x"`,
                        isRecursive: false,
                        keyNodeId: 6,
                        kind: Inspection.ScopeItemKind.LetVariable,
                        valueNodeId: 10,
                    },
                ]));
        });
    });

    describe(`Parameter`, () => {
        it(`(a, b as number, c as nullable function, optional d, optional e as table) => 1|`, async () =>
            await assertNodeScope(`(a, b as number, c as nullable function, optional d, optional e as table) => 1|`, [
                {
                    identifier: "a",
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
                    identifier: "c",
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
                    identifier: "e",
                    kind: Inspection.ScopeItemKind.Parameter,
                    isRecursive: false,
                    isNullable: false,
                    isOptional: true,
                    type: Constant.PrimitiveTypeConstant.Table,
                },
            ]));
    });
});
