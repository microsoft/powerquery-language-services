// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Language, Parser, Task, TaskUtils } from "../../../src";
import { AssertTestUtils } from "../../testUtils";
import { NoOpTraceManagerInstance } from "../../../src/common/trace";

const { Ast, AstUtils }: typeof Language = Language;
const { NodeIdMapIterator, NodeIdMapUtils, ParseStateUtils }: typeof Parser = Parser;

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Language.Ast.NodeKind;
}

function createActual(lexParseOk: Task.ParseTaskOk): ChildIdsByIdEntry[] {
    const actual: ChildIdsByIdEntry[] = [];
    const astNodeById: Parser.NodeIdMap.AstNodeById = lexParseOk.nodeIdMapCollection.astNodeById;

    for (const [key, value] of lexParseOk.nodeIdMapCollection.childIdsById.entries()) {
        actual.push({
            childNodeIds: value,
            id: key,
            kind: Assert.asDefined(astNodeById.get(key)).kind,
        });
    }

    return actual;
}

describe("Parser.Children", () => {
    for (const parser of [Parser.CombinatorialParserV2, Parser.RecursiveDescentParser]) {
        describe(
            parser === Parser.CombinatorialParserV2 ? "Combinatorial child storage" : "Recursive child storage",
            () => {
                it("keeps wide list children in source order and selects the last attribute", async () => {
                    const values: number[] = Array.from({ length: 256 }, (_: unknown, index: number) => index);

                    const result: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(
                        { ...DefaultSettings, parser },
                        `{${values.join(",")}}`,
                    );

                    const list: Language.Ast.ListExpression = AstUtils.assertAsNodeKind<Language.Ast.ListExpression>(
                        result.ast,
                        Ast.NodeKind.ListExpression,
                    );

                    const children: ReadonlyArray<Parser.TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
                        result.nodeIdMapCollection,
                        list.content.id,
                    );

                    expect(children.map((child: Parser.TXorNode) => child.node.id)).to.deep.equal(
                        list.content.elements.map((csv: Language.Ast.ICsv<Language.Ast.TListItem>) => csv.id),
                    );

                    const last: Language.Ast.TNode = NodeIdMapUtils.assertNthChildAst(
                        result.nodeIdMapCollection,
                        list.content.id,
                        values.length - 1,
                    );

                    expect(last).to.equal(list.content.elements[values.length - 1]);

                    expect(
                        NodeIdMapUtils.nthChildXor(result.nodeIdMapCollection, list.content.id, values.length),
                    ).to.equal(undefined);
                });

                it("preserves absent optional attributes in child and sibling selection", async () => {
                    const result: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(
                        { ...DefaultSettings, parser },
                        "(x) => x",
                    );

                    const fn: Language.Ast.FunctionExpression =
                        AstUtils.assertAsNodeKind<Language.Ast.FunctionExpression>(
                            result.ast,
                            Ast.NodeKind.FunctionExpression,
                        );

                    const maps: Parser.NodeIdMap.Collection = result.nodeIdMapCollection;
                    expect(NodeIdMapUtils.nthChildXor(maps, fn.id, 1)).to.equal(undefined);
                    expect(NodeIdMapUtils.assertNthChildAst(maps, fn.id, 2)).to.equal(fn.fatArrowConstant);
                    expect(NodeIdMapUtils.assertNthChildAst(maps, fn.id, 3)).to.equal(fn.expression);
                    expect(NodeIdMapIterator.nextSiblingXor(maps, fn.parameters.id)).to.equal(undefined);

                    expect(NodeIdMapIterator.nthSiblingXor(maps, fn.parameters.id, 2)?.node).to.equal(
                        fn.fatArrowConstant,
                    );

                    expect(NodeIdMapIterator.nextSiblingXor(maps, fn.fatArrowConstant.id)?.node).to.equal(
                        fn.expression,
                    );

                    expect(NodeIdMapIterator.nthSiblingXor(maps, fn.expression.id, -1)?.node).to.equal(
                        fn.fatArrowConstant,
                    );
                });

                it("selects unfinished contexts after an absent return type", async () => {
                    const error: Parser.ParseError.ParseError = await AssertTestUtils.assertGetParseError(
                        { ...DefaultSettings, parser },
                        "() => let",
                    );

                    const maps: Parser.NodeIdMap.Collection = error.state.contextState.nodeIdMapCollection;

                    const fnId: number = Assert.asDefined(
                        maps.idsByNodeKind.get(Ast.NodeKind.FunctionExpression)?.values().next().value,
                    );

                    expect(NodeIdMapUtils.nthChildXor(maps, fnId, 1)).to.equal(undefined);
                    expect(NodeIdMapUtils.assertNthChildAst(maps, fnId, 2).kind).to.equal(Ast.NodeKind.Constant);

                    expect(NodeIdMapUtils.assertNthChildContext(maps, fnId, 3).kind).to.equal(
                        Ast.NodeKind.LetExpression,
                    );

                    expect(NodeIdMapUtils.nthChildAst(maps, fnId, 3)).to.equal(undefined);
                });

                it("isolates appends, inserted parents, deletion, and checkpoint rollback in speculative copies", async () => {
                    const lex: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, "number text logical");
                    TaskUtils.assertIsLexStageOk(lex);
                    const state: Parser.ParseState = ParseStateUtils.newState(lex.lexerSnapshot);
                    const root: Parser.ParseContext.TNode = ParseStateUtils.startContext(state, Ast.NodeKind.ListType);

                    const retained: Language.Ast.PrimitiveType = await parser.readPrimitiveType(
                        state,
                        parser,
                        undefined,
                    );

                    ParseStateUtils.incrementAttributeCounter(state);
                    const copied: Parser.ParseState = await parser.copyState(state);
                    expect(copied.contextState.root).to.equal(copied.currentContextNode);
                    const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(copied);

                    const speculative: Language.Ast.PrimitiveType = await parser.readPrimitiveType(
                        copied,
                        parser,
                        undefined,
                    );

                    const wrapper: Parser.ParseContext.TNode = ParseStateUtils.startContextAsParent(
                        copied,
                        Ast.NodeKind.NullablePrimitiveType,
                        speculative.id,
                        undefined,
                    );

                    const originalMaps: Parser.NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
                    const copiedMaps: Parser.NodeIdMap.Collection = copied.contextState.nodeIdMapCollection;
                    expect(NodeIdMapUtils.assertNthChildContext(copiedMaps, root.id, 2)).to.equal(wrapper);
                    expect(NodeIdMapUtils.assertNthChildAst(copiedMaps, wrapper.id, 0)).to.equal(speculative);
                    expect(originalMaps.childIdsById.get(root.id)).to.deep.equal([retained.id]);
                    expect(NodeIdMapUtils.nthChildXor(originalMaps, root.id, 2)).to.equal(undefined);
                    ParseStateUtils.deleteContext(copied, wrapper.id);
                    expect(NodeIdMapUtils.assertNthChildAst(copiedMaps, root.id, 2)).to.equal(speculative);

                    await parser.restoreCheckpoint(copied, checkpoint);
                    expect(copiedMaps.childIdsById.get(root.id)).to.deep.equal([retained.id]);
                    expect(NodeIdMapUtils.nthChildXor(copiedMaps, root.id, 1)).to.equal(undefined);
                    expect(NodeIdMapUtils.nthChildXor(copiedMaps, root.id, 2)).to.equal(undefined);

                    const retried: Language.Ast.PrimitiveType = await parser.readPrimitiveType(
                        copied,
                        parser,
                        undefined,
                    );

                    expect(retried.id).to.equal(speculative.id);
                    expect(retried.attributeIndex).to.equal(2);
                    expect(NodeIdMapUtils.assertNthChildAst(copiedMaps, root.id, 2)).to.equal(retried);

                    const independent: Language.Ast.PrimitiveType = await parser.readPrimitiveType(
                        state,
                        parser,
                        undefined,
                    );

                    Parser.ParseContextUtils.deleteAst(state.contextState, independent.id, false);
                    expect(NodeIdMapUtils.nthChildXor(originalMaps, root.id, 2)).to.equal(undefined);
                    expect(NodeIdMapUtils.assertNthChildAst(copiedMaps, root.id, 2)).to.equal(retried);
                    expect(root.attributeCounter).to.equal(2);
                });
            },
        );
    }

    it("retains first-child attribute selection after operator reparenting", async () => {
        const result: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, "1 + 2 * 3");

        const outer: Language.Ast.ArithmeticExpression = AstUtils.assertAsNodeKind<Language.Ast.ArithmeticExpression>(
            result.ast,
            Ast.NodeKind.ArithmeticExpression,
        );

        const inner: Language.Ast.ArithmeticExpression = AstUtils.assertAsNodeKind<Language.Ast.ArithmeticExpression>(
            outer.right,
            Ast.NodeKind.ArithmeticExpression,
        );

        expect(NodeIdMapUtils.assertNthChildAst(result.nodeIdMapCollection, outer.id, 0)).to.equal(outer.left);
        expect(NodeIdMapUtils.nthChildXor(result.nodeIdMapCollection, outer.id, 2)).to.equal(undefined);
        expect(NodeIdMapUtils.assertNthChildAst(result.nodeIdMapCollection, inner.id, 2)).to.equal(inner.left);

        const copy: Parser.NodeIdMap.MutableCollection = NodeIdMapUtils.copy(result.nodeIdMapCollection);
        expect(NodeIdMapUtils.assertNthChildAst(copy, outer.id, 0).id).to.equal(outer.left.id);
    });

    it("keeps operator error contexts selectable after earlier operator contexts were removed", async () => {
        const error: Parser.ParseError.ParseError = await AssertTestUtils.assertGetParseError(
            { ...DefaultSettings, parser: Parser.CombinatorialParserV2 },
            "1 + 2 *",
        );

        const maps: Parser.NodeIdMap.Collection = error.state.contextState.nodeIdMapCollection;
        const root: Parser.ParseContext.TNode = Assert.asDefined(error.state.contextState.root);
        const unfinished: Parser.ParseContext.TNode = NodeIdMapUtils.assertNthChildContext(maps, root.id, 2);

        expect(unfinished.kind).to.equal(Ast.NodeKind.ArithmeticExpression);
        expect(NodeIdMapUtils.nthChildXor(maps, root.id, 1)).to.equal(undefined);
        expect(NodeIdMapUtils.nthChildXor(maps, unfinished.id, 0)).to.equal(undefined);

        expect(
            NodeIdMapUtils.assertNthChildAstChecked<Language.Ast.TConstant>(
                maps,
                unfinished.id,
                1,
                Ast.NodeKind.Constant,
            ).constantKind,
        ).to.equal("*");

        expect(NodeIdMapUtils.assertNthChildContext(maps, unfinished.id, 2).kind).to.equal(
            Ast.NodeKind.LiteralExpression,
        );
    });

    it("remaps direct attribute slots without changing the published source collection", async () => {
        const result: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, "() => 1");

        const fn: Language.Ast.FunctionExpression = AstUtils.assertAsNodeKind<Language.Ast.FunctionExpression>(
            result.ast,
            Ast.NodeKind.FunctionExpression,
        );

        const copy: Parser.NodeIdMap.MutableCollection = NodeIdMapUtils.copy(result.nodeIdMapCollection);

        const newIds: Map<number, number> = new Map(
            Array.from(copy.astNodeById.keys(), (id: number) => [id, id + 100]),
        );

        NodeIdMapUtils.updateNodeIds(copy, newIds, NoOpTraceManagerInstance, undefined);
        expect(NodeIdMapUtils.nthChildXor(copy, fn.id + 100, 1)).to.equal(undefined);
        expect(NodeIdMapUtils.assertNthChildAst(copy, fn.id + 100, 2).id).to.equal(fn.fatArrowConstant.id + 100);
        expect(NodeIdMapUtils.assertNthChildAst(copy, fn.id + 100, 3).id).to.equal(fn.expression.id + 100);
        expect(NodeIdMapUtils.assertNthChildAst(result.nodeIdMapCollection, fn.id, 3)).to.equal(fn.expression);
    });

    it(`() as number => 1`, async () => {
        const text: string = `() as number => 1`;

        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [2, 6, 9, 11],
                id: 1,
                kind: Language.Ast.NodeKind.FunctionExpression,
            },
            {
                childNodeIds: [3, 4, 5],
                id: 2,
                kind: Language.Ast.NodeKind.ParameterList,
            },
            {
                childNodeIds: [7, 8],
                id: 6,
                kind: Language.Ast.NodeKind.AsNullablePrimitiveType,
            },
        ];

        const actual: ReadonlyArray<ChildIdsByIdEntry> = createActual(
            await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text),
        );

        expect(actual).to.deep.equal(expected);
    });

    it(`null ?? 1 ?? 2`, async () => {
        const text: string = `null ?? 1 ?? 2`;

        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [6, 8, 10],
                id: 11,
                kind: Language.Ast.NodeKind.NullCoalescingExpression,
            },
            {
                childNodeIds: [2, 4, 11],
                id: 12,
                kind: Language.Ast.NodeKind.NullCoalescingExpression,
            },
        ];

        const actual: ReadonlyArray<ChildIdsByIdEntry> = createActual(
            await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text),
        );

        expect(actual).to.deep.equal(expected);
    });
});
