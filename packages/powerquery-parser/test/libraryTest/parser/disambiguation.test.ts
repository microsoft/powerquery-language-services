// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { rejects } from "assert";

import { DefaultSettings, Language, Lexer, Parser, ResultUtils, Settings, Task, TaskUtils } from "../../../src";
import { AmbiguousParse } from "../../../src/parser/disambiguation/disambiguation";
import { DisambiguationUtils } from "../../../src/parser/disambiguation";
import { validateNodeIdMapCollection } from "./parserTestUtils";

describe("bounded disambiguation", () => {
    const parsers: ReadonlyArray<[string, Parser.Parser]> = [
        ["recursive descent", Parser.RecursiveDescentParser],
        ["combinatorial", Parser.CombinatorialParserV2],
    ];

    function newState(text: string): Parser.ParseState {
        const lexed: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
        ResultUtils.assertIsOk(lexed);

        return Parser.ParseStateUtils.newState(lexed.value);
    }

    for (const [name, implementation] of parsers) {
        describe(name, () => {
            const parser: Parser.Parser = {
                ...implementation,
                copyState: (): never => {
                    throw new Error("Disambiguation must not copy the parser state");
                },
            };

            it("replays the furthest alternative and retains only its node maps", async () => {
                const state: Parser.ParseState = newState("number text");

                const parent: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
                    state,
                    Language.Ast.NodeKind.ListType,
                );

                const result: AmbiguousParse<Language.Ast.PrimitiveType> = await DisambiguationUtils.readAmbiguous(
                    state,
                    parser,
                    [
                        async (state: Parser.ParseState): Promise<Language.Ast.PrimitiveType> => {
                            await parser.readPrimitiveType(state, parser, undefined);

                            return parser.readPrimitiveType(state, parser, undefined);
                        },
                        parser.readPrimitiveType,
                    ],
                    undefined,
                );

                ResultUtils.assertIsOk(result.result);
                expect(result.parseState).to.equal(state);
                expect(state.tokenIndex).to.equal(2);
                expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(2);
                expect(parent.attributeCounter).to.equal(2);
                expect(state.contextState.nodeIdMapCollection.rightMostLeaf).to.equal(result.result.value);

                validateNodeIdMapCollection(state.contextState.nodeIdMapCollection, {
                    kind: Parser.XorNodeKind.Context,
                    node: parent,
                });
            });

            it("prefers success on equal progress, and callback order on equal successes", async () => {
                const state: Parser.ParseState = newState("number");

                const result: AmbiguousParse<Language.Ast.TNode> =
                    await DisambiguationUtils.readAmbiguous<Language.Ast.TNode>(
                        state,
                        parser,
                        [
                            async (state: Parser.ParseState): Promise<Language.Ast.TNode> => {
                                await parser.readPrimitiveType(state, parser, undefined);
                                throw new Parser.ParseError.ExpectedTokenKindError(
                                    Language.Token.TokenKind.Comma,
                                    undefined,
                                    state.locale,
                                );
                            },
                            parser.readPrimitiveType,
                            parser.readNullablePrimitiveType,
                        ],
                        undefined,
                    );

                ResultUtils.assertIsOk(result.result);
                expect(result.result.value.kind).to.equal(Language.Ast.NodeKind.PrimitiveType);
                expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(1);
                expect(state.contextState.root?.id).to.equal(result.result.value.id);
            });

            it("retains the furthest error's partial tree after rollback", async () => {
                const state: Parser.ParseState = newState("number text");

                const result: AmbiguousParse<Language.Ast.PrimitiveType> = await DisambiguationUtils.readAmbiguous(
                    state,
                    parser,
                    [
                        async (state: Parser.ParseState): Promise<Language.Ast.PrimitiveType> => {
                            await parser.readPrimitiveType(state, parser, undefined);
                            await parser.readPrimitiveType(state, parser, undefined);

                            return parser.readPrimitiveType(state, parser, undefined);
                        },
                        async (state: Parser.ParseState): Promise<Language.Ast.PrimitiveType> => {
                            await parser.readPrimitiveType(state, parser, undefined);
                            throw new Parser.ParseError.ExpectedTokenKindError(
                                Language.Token.TokenKind.Comma,
                                undefined,
                                state.locale,
                            );
                        },
                    ],
                    undefined,
                );

                ResultUtils.assertIsError(result.result);
                expect(result.result.error.state).to.equal(state);
                expect(state.tokenIndex).to.equal(2);
                expect(state.contextState.nodeIdMapCollection.astNodeById.size).to.equal(2);
                expect(result.result.error.innerError).to.be.instanceOf(Parser.ParseError.ExpectedAnyTokenKindError);
            });

            it("bounds malformed nested parentheses with a structured parse error", async () => {
                const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                    { ...DefaultSettings, parser },
                    "(".repeat(2000),
                );

                TaskUtils.assertIsParseStageParseError(result);
                expect(result.error.innerError).to.be.instanceOf(Parser.ParseError.SpeculativeWorkLimitExceededError);
                expect(result.parseState.speculativeWorkBudget.remaining).to.equal(0);
                expect(result.parseState.speculativeWorkBudget.depth).to.equal(0);
                expect(result.parseState.contextState.idCounter).to.be.lessThan(2000);
            });

            it("preserves valid parenthesized and function interpretations", async () => {
                for (const text of [
                    "(1) + 2",
                    "(x as number) as number => x",
                    "((x) => x)(1)",
                    "[x = (1 + 2)][x]",
                    `${"(".repeat(300)}1${")".repeat(300)}`,
                ]) {
                    // eslint-disable-next-line no-await-in-loop
                    const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                        { ...DefaultSettings, parser },
                        text,
                    );

                    TaskUtils.assertIsParseStageOk(result);
                    validateNodeIdMapCollection(result.nodeIdMapCollection, Parser.XorNodeUtils.boxAst(result.ast));
                }
            });
        });
    }

    it("checks the shared budget before nested attempts and never rewinds it", async () => {
        const state: Parser.ParseState = newState("number");
        state.speculativeWorkBudget = { limit: 2, remaining: 2, depth: 0 };
        const parser: Parser.Parser = DefaultSettings.parser;
        const checkpoint: Parser.ParseStateCheckpoint = await parser.checkpoint(state);
        let started: number = 0;

        async function nested(state: Parser.ParseState): Promise<Language.Ast.TNode> {
            started += 1;

            const result: AmbiguousParse<Language.Ast.TNode> = await DisambiguationUtils.readAmbiguous(
                state,
                parser,
                [nested],
                undefined,
            );

            ResultUtils.assertIsOk(result.result);

            return result.result.value;
        }

        await rejects(
            DisambiguationUtils.readAmbiguous(state, parser, [nested], undefined),
            Parser.ParseError.SpeculativeWorkLimitExceededError,
        );

        expect(started).to.equal(2);
        expect(state.speculativeWorkBudget.depth).to.equal(0);
        await parser.restoreCheckpoint(state, checkpoint);
        const copied: Parser.ParseState = await parser.copyState(state);
        expect(copied.speculativeWorkBudget).to.equal(state.speculativeWorkBudget);
        expect(copied.speculativeWorkBudget.remaining).to.equal(0);
    });

    it("shares the budget across document alternatives and freshens it for each parse", async () => {
        const budgets: Parser.SpeculativeWorkBudget[] = [];

        const parser: Parser.Parser = {
            ...DefaultSettings.parser,
            readExpression: (state: Parser.ParseState): Promise<Language.Ast.TExpression> => {
                budgets.push(state.speculativeWorkBudget);
                Parser.ParseStateUtils.consumeSpeculativeWork(state);
                throw new Parser.ParseError.ExpectedTokenKindError(
                    Language.Token.TokenKind.Comma,
                    undefined,
                    state.locale,
                );
            },
            readSectionDocument: (state: Parser.ParseState): Promise<Language.Ast.Section> => {
                budgets.push(state.speculativeWorkBudget);
                Parser.ParseStateUtils.consumeSpeculativeWork(state);
                throw new Error("Exhaustion must prevent reaching this statement");
            },
        };

        const settings: Settings = { ...DefaultSettings, parser, maximumSpeculativeWork: 1 };

        for (let index: number = 0; index < 2; index += 1) {
            // eslint-disable-next-line no-await-in-loop
            const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, "number");
            TaskUtils.assertIsParseStageParseError(result);
            expect(result.error.innerError).to.be.instanceOf(Parser.ParseError.SpeculativeWorkLimitExceededError);
        }

        expect(budgets).to.have.length(4);
        expect(budgets[0]).to.equal(budgets[1]);
        expect(budgets[2]).to.equal(budgets[3]);
        expect(budgets[0]).not.to.equal(budgets[2]);
    });

    it("charges winner replays before starting them", async () => {
        const state: Parser.ParseState = newState("number");
        state.speculativeWorkBudget = { limit: 4, remaining: 4, depth: 0 };
        const parser: Parser.Parser = DefaultSettings.parser;
        let started: number = 0;

        function read(state: Parser.ParseState): Promise<Language.Ast.PrimitiveType> {
            started += 1;

            return parser.readPrimitiveType(state, parser, undefined);
        }

        await rejects(
            DisambiguationUtils.readAmbiguous(state, parser, [read, read], undefined),
            Parser.ParseError.SpeculativeWorkLimitExceededError,
        );

        expect(started).to.equal(2);
        expect(state.speculativeWorkBudget.remaining).to.equal(0);
    });

    it("does not replace exhaustion with a section diagnostic", async () => {
        let sectionAttempts: number = 0;

        const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
            {
                ...DefaultSettings,
                maximumSpeculativeWork: 0,
                parser: {
                    ...DefaultSettings.parser,
                    readSectionDocument: (): Promise<Language.Ast.Section> => {
                        sectionAttempts += 1;
                        throw new Error("Exhaustion is terminal");
                    },
                },
            },
            "(",
        );

        TaskUtils.assertIsParseStageParseError(result);
        expect(result.error.innerError).to.be.instanceOf(Parser.ParseError.SpeculativeWorkLimitExceededError);
        expect(sectionAttempts).to.equal(0);

        expect(Parser.ParseError.tokenFrom(result.error.innerError)?.kind).to.equal(
            Language.Token.TokenKind.LeftParenthesis,
        );
    });
});
