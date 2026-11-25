// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { rejects } from "assert";

import {
    CommonError,
    CounterCancellationToken,
    DefaultSettings,
    Language,
    Lexer,
    NoOpCancellationToken,
    Parser,
    ResultUtils,
    Task,
    TaskUtils,
} from "../../../src";
import { Disambiguation, DisambiguationUtils } from "../../../src/parser/disambiguation";
import { validateNodeIdMapCollection } from "./parserTestUtils";

describe("parser resource hardening", () => {
    function newState(text: string, overrides?: Partial<Parser.ParseState>): Parser.ParseState {
        const lexed: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
        ResultUtils.assertIsOk(lexed);

        return Parser.ParseStateUtils.newState(lexed.value, overrides);
    }

    it("takes ownership without modifying caller-supplied readonly children", () => {
        const children: ReadonlyArray<number> = Object.freeze([1, 2]);
        const map: Parser.NodeIdMap.ChildIdsById = new Map([[0, children]]);
        Parser.NodeIdMapUtils.appendChildId(map, 0, 3);
        expect(children).to.deep.equal([1, 2]);
        expect(map.get(0)).to.deep.equal([1, 2, 3]);

        const published: ReadonlyArray<number> = Object.freeze(Parser.NodeIdMapUtils.assertChildIds(map, 0));
        Parser.NodeIdMapUtils.appendChildId(map, 0, 4);
        expect(published).to.deep.equal([1, 2, 3]);
        expect(map.get(0)).to.deep.equal([1, 2, 3, 4]);
    });

    for (const [name, parser] of [
        ["recursive descent", Parser.RecursiveDescentParser],
        ["combinatorial", Parser.CombinatorialParserV2],
    ] as const) {
        describe(name, () => {
            for (const size of [1000, 2000, 4000]) {
                it(`visits only linear lookahead tokens for ${size} balanced parentheses`, async () => {
                    let polls: number = 0;

                    const state: Parser.ParseState = newState(`${"(".repeat(size)}1${")".repeat(size)}`, {
                        cancellationToken: {
                            ...NoOpCancellationToken,
                            throwIfCancelled: (): void => {
                                polls += 1;
                            },
                        },
                    });

                    for (let index: number = 0; index < size; index += 1) {
                        state.tokenIndex = index;

                        // eslint-disable-next-line no-await-in-loop
                        expect(await DisambiguationUtils.disambiguateParenthesis(state, parser, undefined)).to.equal(
                            Disambiguation.ParenthesisDisambiguation.ParenthesizedExpression,
                        );
                    }

                    expect(polls).to.be.at.most(4 * size);
                    expect(state.speculativeWorkBudget.remaining).to.equal(state.speculativeWorkBudget.limit);
                });
            }

            it("parses deep valid nesting without exhausting the speculative budget", async () => {
                const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                    { ...DefaultSettings, parser },
                    `${"(".repeat(1000)}1${")".repeat(1000)}`,
                );

                TaskUtils.assertIsParseStageOk(result);
                validateNodeIdMapCollection(result.nodeIdMapCollection, Parser.XorNodeUtils.boxAst(result.ast));
            });

            it("charges cached unmatched lookahead without allocating an unbounded partial tree", async () => {
                const state: Parser.ParseState = newState("(".repeat(2000));
                expect(await DisambiguationUtils.disambiguateParenthesis(state, parser, undefined)).to.equal(undefined);
                state.speculativeWorkBudget = { limit: 10, remaining: 10, depth: 1 };

                await rejects(
                    DisambiguationUtils.disambiguateParenthesis(state, parser, undefined),
                    Parser.ParseError.SpeculativeWorkLimitExceededError,
                );

                expect(state.speculativeWorkBudget.remaining).to.equal(0);
                expect(state.contextState.idCounter).to.equal(0);
            });

            it("cancels both scanned and cached lookahead", async () => {
                const cancellationToken: CounterCancellationToken = new CounterCancellationToken(20);

                const state: Parser.ParseState = newState(`${"(".repeat(100)}1${")".repeat(100)}`, {
                    cancellationToken,
                });

                await rejects(
                    DisambiguationUtils.disambiguateParenthesis(state, parser, undefined),
                    CommonError.CancellationError,
                );

                const cachedToken: CounterCancellationToken = new CounterCancellationToken(100);
                const cachedState: Parser.ParseState = newState("(1)", { cancellationToken: cachedToken });
                await DisambiguationUtils.disambiguateParenthesis(cachedState, parser, undefined);
                cachedToken.cancel("cancel cached lookup");

                await rejects(
                    DisambiguationUtils.disambiguateParenthesis(cachedState, parser, undefined),
                    CommonError.CancellationError,
                );
            });

            it("keeps wide child arrays owned and copies isolated across append and removal", async () => {
                const state: Parser.ParseState = newState("number text");

                const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
                    state,
                    Language.Ast.NodeKind.ArrayWrapper,
                );

                await parser.readPrimitiveType(state, parser, undefined);
                const snapshot: Parser.ParseState = await parser.copyState(state);

                const originalChildren: ReadonlyArray<number> = Parser.NodeIdMapUtils.assertChildIds(
                    state.contextState.nodeIdMapCollection.childIdsById,
                    parent.id,
                );

                const snapshotChildren: ReadonlyArray<number> = Parser.NodeIdMapUtils.assertChildIds(
                    snapshot.contextState.nodeIdMapCollection.childIdsById,
                    parent.id,
                );

                expect(snapshotChildren).not.to.equal(originalChildren);
                const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
                const root: Parser.ParseContext.TNode | undefined = state.contextState.root;
                const leaf: Language.Ast.TNode | undefined = state.contextState.nodeIdMapCollection.rightMostLeaf;

                await parser.readPrimitiveType(state, parser, undefined);

                for (let index: number = 0; index < 4000; index += 1) {
                    Parser.ParseContextUtils.startContext(
                        state.contextState,
                        Language.Ast.NodeKind.PrimitiveType,
                        state.tokenIndex,
                        state.currentToken,
                        parent,
                    );

                    expect(state.contextState.nodeIdMapCollection.childIdsById.get(parent.id)).to.equal(
                        originalChildren,
                    );
                }

                expect(originalChildren).to.have.length(4002);
                expect(snapshotChildren).to.have.length(1);
                await parser.restoreCheckpoint(state, checkpoint);
                expect(originalChildren).to.have.length(1);
                expect(snapshotChildren).to.have.length(1);
                expect(parent.attributeCounter).to.equal(1);
                expect(state.contextState.root).to.equal(root);
                expect(state.contextState.nodeIdMapCollection.rightMostLeaf).to.equal(leaf);

                validateNodeIdMapCollection(
                    state.contextState.nodeIdMapCollection,
                    Parser.XorNodeUtils.boxContext(parent),
                );

                await parser.readPrimitiveType(snapshot, parser, undefined);
                expect(snapshot.contextState.nodeIdMapCollection.childIdsById.get(parent.id)).to.have.length(2);
                expect(originalChildren).to.have.length(1);
            });

            it("keeps child-map writes linear for valid wide lists", async () => {
                const size: number = 1000;
                let writtenEntries: number = 0;

                const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                    {
                        ...DefaultSettings,
                        parser,
                        newParseState: (snapshot: Lexer.LexerSnapshot, overrides?: Partial<Parser.ParseState>) => {
                            const state: Parser.ParseState = Parser.ParseStateUtils.newState(snapshot, overrides);

                            const children: Parser.NodeIdMap.ChildIdsById =
                                state.contextState.nodeIdMapCollection.childIdsById;

                            const set: typeof children.set = children.set.bind(children);

                            children.set = (id: number, value: ReadonlyArray<number>): typeof children => {
                                writtenEntries += value.length;

                                return set(id, value);
                            };

                            return state;
                        },
                    },
                    `{${Array.from({ length: size }, () => "1").join(",")}}`,
                );

                TaskUtils.assertIsParseStageOk(result);
                expect(writtenEntries).to.be.lessThan(20 * size);
                validateNodeIdMapCollection(result.nodeIdMapCollection, Parser.XorNodeUtils.boxAst(result.ast));
            });
        });
    }
});
