// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQP from "@microsoft/powerquery-parser";
import { Ast, Constant } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { NodeIdMap } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";
import type { Position } from "vscode-languageserver-types";

import { Inspection, InspectionSettings, Library, TypeStrategy } from "../../powerquery-language-services";
import { TestUtils } from "..";

export type TAbridgedNodeScopeItem =
    | AbridgedEachScopeItem
    | AbridgedLetVariableScopeItem
    | AbridgedParameterScopeItem
    | AbridgedRecordScopeItem
    | AbridgedSectionMemberScopeItem
    | AbridgedUndefinedScopeItem;

type AbridgedNodeScope = ReadonlyArray<TAbridgedNodeScopeItem>;

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

function createAbridgedParameterScopeItems(nodeScope: Inspection.NodeScope): ReadonlyArray<AbridgedParameterScopeItem> {
    const result: AbridgedParameterScopeItem[] = [];

    for (const [identifier, scopeItem] of nodeScope.entries()) {
        const abridged: TAbridgedNodeScopeItem = createAbridgedNodeScopeItem(identifier, scopeItem);

        if (abridged.kind === Inspection.ScopeItemKind.Parameter) {
            result.push(abridged);
        }
    }

    return result;
}

async function assertNodeScopeOk(
    settings: PQP.CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
): Promise<Inspection.NodeScope> {
    const activeNode: Inspection.TActiveNode = Inspection.ActiveNodeUtils.activeNode(nodeIdMapCollection, position);

    if (!Inspection.ActiveNodeUtils.isPositionInBounds(activeNode)) {
        return new Map();
    }

    const triedNodeScope: Inspection.TriedNodeScope = await Inspection.tryNodeScope(
        settings,
        nodeIdMapCollection,
        activeNode.ancestry[0].node.id,
        new Map(),
    );

    Assert.isOk(triedNodeScope);

    return triedNodeScope.value;
}

export async function assertGetParseOkScopeOk(
    settings: PQP.LexSettings & PQP.ParseSettings,
    text: string,
    position: Position,
): Promise<Inspection.NodeScope> {
    const parseOk: PQP.Task.ParseTaskOk = await TestUtils.assertGetLexParseOk(settings, text);

    return assertNodeScopeOk(settings, parseOk.nodeIdMapCollection, position);
}

export async function assertGetParseErrScopeOk(
    settings: PQP.LexSettings & PQP.ParseSettings,
    text: string,
    position: Position,
): Promise<Inspection.NodeScope> {
    const parseError: PQP.Task.ParseTaskParseError = await TestUtils.assertGetLexParseError(settings, text);

    return assertNodeScopeOk(settings, parseError.nodeIdMapCollection, position);
}

describe(`subset Inspection - Scope - Identifier`, () => {
    describe(`Scope`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
            it(`|each 1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|each 1`);
                const expected: ReadonlyArray<TAbridgedNodeScopeItem> = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`each| 1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`each| 1`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`each |1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`each |1`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 1,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`each 1|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`each 1|`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 1,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`each each 1|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`each each 1|`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 3,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
            it(`each|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`each|`);
                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`each |`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`each |`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        isRecursive: false,
                        kind: Inspection.ScopeItemKind.Each,
                        eachExpressionNodeId: 1,
                    },
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|(x) => z`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(x|, y) => z`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x|, y) => z`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(x, y)| => z`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x, y)| => z`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(x, y) => z|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x, y) => z|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|(x) =>`);
                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(x|, y) =>`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x|, y) =>`);
                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(x, y)| =>`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x, y)| =>`);
                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(x, y) =>|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`(x, y) =>|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`let x = 1, y = x in 1|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let x = 1, y = x in 1|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[a=1]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|[a=1]`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[|a=1]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[|a=1]`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1|]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1|]`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1, b=2|]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1, b=2|]`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1, b=2|, c=3]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1, b=2|, c=3]`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1]|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1]|`);
                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=[|b=1]]`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=[|b=1]]`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[a=1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`|[a=1`);
                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[|a=1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[|a=1`);
                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=|1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=|1`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1|`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 12,
                    },
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1, b=|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1, b=|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=1, b=2|, c=3`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=1, b=2|, c=3`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=[|b=1`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=[|b=1`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.RecordField,
                        isRecursive: true,
                        keyNodeId: 8,
                        valueNodeId: 10,
                    },
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`[a=[b=|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`[a=[b=|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.Section} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`s|ection foo; x = 1; y = 2;`);

                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1|; y = 2;`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`section foo; x = 1|; y = 2;`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1; y = 2|;`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`section foo; x = 1; y = 2|;`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1; y = 2;|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`section foo; x = 1; y = 2;|`);

                const expected: AbridgedNodeScope = [];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `section foo; x = 1; y = 2; z = let a = 1 in |b;`,
                );

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            it(`s|ection foo; x = 1; y = 2`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`s|ection foo; x = 1; y = 2`);

                const expected: AbridgedNodeScope = [];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1|; y = 2`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`section foo; x = 1|; y = 2`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1; y = 2|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`section foo; x = 1; y = 2|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`section foo; x = 1; y = () => 10|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `section foo; x = 1; y = () => 10|`,
                );

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1 in |x`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 in |x`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let a = 1 in x|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 in x|`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let a = |1 in x`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = |1 in x`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "@a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: true,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let a = 1, b = 2 in x|`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let a = 1, b = 2 in x|`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let a = 1|, b = 2 in x`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let a = 1|, b = 2 in x`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `(p1, p2) => let a = 1, b = 2, c = 3| in c`,
                );

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
                );

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                    `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
                );

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedNodeScopeItems(
                    await assertGetParseOkScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1 in |`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`let a = 1 in |`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 10,
                    },
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let a = 1, b = 2 in |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let a = 1, b = 2 in |`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let a = 1|, b = 2 in`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let a = 1|, b = 2 in `);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let x = (let y = 1 in z|) in`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let x = (let y = 1 in z|) in`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`let x = (let y = 1 in z) in |`, async () => {
                const [text, position]: [string, Position] =
                    TestUtils.assertGetTextWithPosition(`let x = (let y = 1 in z) in |`);

                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: Inspection.ScopeItemKind.LetVariable,
                        isRecursive: false,
                        keyNodeId: 6,
                        valueNodeId: 9,
                    },
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });

            it(`an EachExpression contains the parent's scope;`, async () => {
                const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(`
let
    tbl = 1 as table,
    bar = "bar"
in
    each |`);

                const expected: AbridgedNodeScope = [
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
                ];

                const actual: AbridgedNodeScope = createAbridgedNodeScopeItems(
                    await assertGetParseErrScopeOk(DefaultSettings, text, position),
                );

                expect(actual).to.deep.equal(expected);
            });
        });
    });

    describe(`Parameter`, () => {
        it(`(a, b as number, c as nullable function, optional d, optional e as table) => 1|`, async () => {
            const [text, position]: [string, Position] = TestUtils.assertGetTextWithPosition(
                `(a, b as number, c as nullable function, optional d, optional e as table) => 1|`,
            );

            const expected: ReadonlyArray<AbridgedParameterScopeItem> = [
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
            ];

            const actual: ReadonlyArray<TAbridgedNodeScopeItem> = createAbridgedParameterScopeItems(
                await assertGetParseOkScopeOk(DefaultSettings, text, position),
            );

            expect(actual).to.deep.equal(expected);
        });
    });
});
