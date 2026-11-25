// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { rejects } from "assert";

import {
    ArrayUtils,
    Assert,
    CommonError,
    DefaultSettings,
    Language,
    Lexer,
    Parser,
    ResultUtils,
    Task,
    TaskUtils,
} from "../../../src";
import { Ast, Constant } from "../../../src/language";
import { OperatorsAndOperands, TOperand } from "../../../src/parser/parsers/combinatorialParserV2/commonTypes";
import { combineOperatorsAndOperands } from "../../../src/parser/parsers/combinatorialParserV2/combineOperatorsAndOperands";
import { NaiveParseSteps } from "../../../src/parser/parsers";
import { readOperatorsAndOperands } from "../../../src/parser/parsers/combinatorialParserV2/readOperatorsAndOperands";
import { validateNodeIdMapCollection } from "./parserTestUtils";

interface ReductionFixture {
    readonly state: Parser.ParseState;
    readonly placeholder: Parser.ParseContext.TNode;
    readonly input: OperatorsAndOperands;
}

async function prepare(text: string): Promise<ReductionFixture> {
    const lexed: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    ResultUtils.assertIsOk(lexed);
    const state: Parser.ParseState = Parser.ParseStateUtils.newState(lexed.value);

    const placeholder: Parser.ParseContext.TNode = Parser.ParseStateUtils.startContext(
        state,
        Ast.NodeKind.ArithmeticExpression,
    );

    const input: OperatorsAndOperands = await readOperatorsAndOperands(state, Parser.CombinatorialParserV2, undefined);

    return { state, placeholder, input };
}

function reduce(fixture: ReductionFixture, parser: Parser.Parser = Parser.CombinatorialParserV2): Promise<TOperand> {
    return combineOperatorsAndOperands(fixture.state, parser, fixture.placeholder.id, fixture.input, 0);
}

function reductions(collection: Parser.NodeIdMap.Collection): ReadonlyArray<readonly [string, number, number]> {
    return [...collection.astNodeById.values()]
        .filter(Language.AstUtils.isTBinOpExpression)
        .map((node: Ast.TBinOpExpression) => [
            node.operatorConstant.constantKind,
            node.tokenRange.tokenIndexStart,
            node.tokenRange.tokenIndexEnd,
        ]);
}

describe("combinatorial operator reduction", () => {
    for (const [text, expected] of [
        [
            "1 + 2 * 3 - 4 / 5 & 6",
            [
                ["*", 2, 4],
                ["/", 6, 8],
                ["+", 0, 4],
                ["-", 0, 8],
                ["&", 0, 10],
            ],
        ],
        [
            "1 * 2 + 3 * 4 = 5 * 6",
            [
                ["*", 0, 2],
                ["*", 4, 6],
                ["*", 8, 10],
                ["+", 0, 6],
                ["=", 0, 10],
            ],
        ],
        [
            "1 meta 2 * 3 + 4 < 5 = 6 as number is number and true or false ?? 0",
            [
                ["meta", 0, 2],
                ["*", 0, 4],
                ["+", 0, 6],
                ["<", 0, 8],
                ["=", 0, 10],
                ["as", 0, 12],
                ["is", 0, 14],
                ["and", 0, 16],
                ["or", 0, 18],
                ["??", 0, 20],
            ],
        ],
        [
            "1 as number as text",
            [
                ["as", 0, 2],
                ["as", 0, 4],
            ],
        ],
        [
            "1 is number is text",
            [
                ["is", 0, 2],
                ["is", 0, 4],
            ],
        ],
    ] as const) {
        it(`preserves precedence, global left-first allocation, and maps: ${text}`, async () => {
            const task: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                { ...DefaultSettings, parser: Parser.CombinatorialParserV2 },
                text,
            );

            TaskUtils.assertIsParseStageOk(task);
            expect(reductions(task.nodeIdMapCollection)).to.deep.equal(expected);
            validateNodeIdMapCollection(task.nodeIdMapCollection, Parser.XorNodeUtils.boxAst(task.ast));
            expect(task.parseState.tokenIndex).to.equal(task.lexerSnapshot.tokens.length);
            expect(task.parseState.currentToken).to.equal(undefined);

            for (const node of task.nodeIdMapCollection.astNodeById.values()) {
                if (Language.AstUtils.isTBinOpExpression(node)) {
                    expect(task.nodeIdMapCollection.childIdsById.get(node.id)).to.deep.equal([
                        node.left.id,
                        node.operatorConstant.id,
                        node.right.id,
                    ]);

                    expect(node.id).to.be.greaterThan(node.left.id);
                    expect(node.id).to.be.greaterThan(node.right.id);
                }
            }
        });
    }

    it("keeps validator fallback diagnostics, cursor, and partial maps in global reduction order", async () => {
        const fixture: ReductionFixture = await prepare("1 meta 2 meta 3 + 4 * 5");
        const { state, input, placeholder }: ReductionFixture = fixture;

        const marker: Parser.ParseError.ExpectedTokenKindError = new Parser.ParseError.ExpectedTokenKindError(
            Language.Token.TokenKind.Comma,
            undefined,
            state.locale,
        );

        let fallbackTokenIndex: number | undefined;
        const original: typeof NaiveParseSteps.readUnaryExpression = NaiveParseSteps.readUnaryExpression;

        Object.defineProperty(NaiveParseSteps, "readUnaryExpression", {
            configurable: true,
            value: (): Promise<Ast.TUnaryExpression> => {
                fallbackTokenIndex = state.tokenIndex;

                return Promise.reject(marker);
            },
        });

        try {
            await rejects(reduce(fixture), (error: unknown) => error === marker);
        } finally {
            Object.defineProperty(NaiveParseSteps, "readUnaryExpression", { configurable: true, value: original });
        }

        expect(fallbackTokenIndex).to.equal(0);
        expect(state.currentToken).to.equal(state.lexerSnapshot.tokens[0]);
        expect(state.currentTokenKind).to.equal(state.currentToken?.kind);
        const collection: Parser.NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
        expect(reductions(collection)).to.deep.equal([["meta", 0, 2]]);
        const partial: Parser.ParseContext.TNode = Assert.asDefined(state.currentContextNode);
        expect(partial.kind).to.equal(Ast.NodeKind.MetadataExpression);
        expect(partial.attributeCounter).to.equal(0);
        expect(collection.childIdsById.get(partial.id)).to.equal(undefined);
        expect(collection.childIdsById.get(placeholder.id)).to.deep.equal([partial.id]);
        expect(collection.parentIdById.get(partial.id)).to.equal(placeholder.id);

        const completed: Ast.TBinOpExpression = Assert.asDefined(
            [...collection.astNodeById.values()].find(Language.AstUtils.isTBinOpExpression),
        );

        expect(collection.childIdsById.get(completed.id)).to.deep.equal([
            ArrayUtils.assertGet(input.operands, 0).id,
            ArrayUtils.assertGet(input.operatorConstants, 0).id,
            ArrayUtils.assertGet(input.operands, 1).id,
        ]);

        expect(collection.contextNodeById.size).to.equal(2);
        expect(collection.astNodeById.size).to.equal(4);
    });

    it("retains the original invariant when a left validator fallback returns", async () => {
        const fixture: ReductionFixture = await prepare("1 meta 2 meta 3 + 4 * 5");

        await rejects(
            reduce(fixture),
            (error: unknown) =>
                error instanceof CommonError.InvariantError &&
                error.invariantBroken === "validateLeftOperand failed and then fallbackLeftOperand did not throw.",
        );

        expect(reductions(fixture.state.contextState.nodeIdMapCollection)).to.deep.equal([["meta", 0, 2]]);
        const collection: Parser.NodeIdMap.Collection = fixture.state.contextState.nodeIdMapCollection;
        expect(fixture.state.tokenIndex).to.equal(1);

        expect([...collection.astNodeById.values()].map((node: Ast.TNode) => [node.kind, node.id])).to.deep.equal([
            [Ast.NodeKind.LiteralExpression, 2],
            [Ast.NodeKind.Constant, 4],
            [Ast.NodeKind.LiteralExpression, 5],
            [Ast.NodeKind.MetadataExpression, 15],
            [Ast.NodeKind.LiteralExpression, 17],
        ]);

        expect([...collection.childIdsById]).to.deep.equal([
            [1, [16]],
            [15, [2, 4, 5]],
            [16, [17]],
        ]);

        expect([...collection.parentIdById]).to.deep.equal([
            [2, 15],
            [15, 1],
            [4, 15],
            [5, 15],
            [16, 1],
            [17, 16],
        ]);

        expect([...collection.leafIds]).to.deep.equal([2, 4, 5, 17]);
    });

    it("awaits a real validator parse rejection and retains its partial tree rather than an invariant", async () => {
        const fixture: ReductionFixture = await prepare("1 as type + 2 * 3");

        await rejects(
            reduce(fixture),
            (error: unknown) =>
                error instanceof Parser.ParseError.ExpectedAnyTokenKindError &&
                error.message.includes("addition operator"),
        );

        const { state }: ReductionFixture = fixture;
        const collection: Parser.NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
        expect(state.tokenIndex).to.equal(3);
        expect(state.currentToken).to.equal(state.lexerSnapshot.tokens[3]);
        expect(state.currentTokenKind).to.equal(Language.Token.TokenKind.Plus);
        expect(reductions(collection)).to.deep.equal([["*", 4, 6]]);

        expect(
            [...collection.contextNodeById.values()].map((node: Parser.ParseContext.TNode) => node.kind),
        ).to.deep.equal([
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.ArithmeticExpression,
            Ast.NodeKind.MetadataExpression,
            Ast.NodeKind.TypePrimaryType,
        ]);

        expect([...collection.childIdsById]).to.deep.equal([
            [1, [13]],
            [12, [8, 10, 11]],
            [13, [14]],
            [14, [15]],
            [15, [16]],
        ]);

        expect([...collection.parentIdById]).to.deep.equal([
            [2, 1],
            [12, 1],
            [8, 12],
            [10, 12],
            [11, 12],
            [13, 1],
            [14, 13],
            [15, 14],
            [16, 15],
        ]);

        const task: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
            { ...DefaultSettings, parser: Parser.CombinatorialParserV2 },
            "1 as type + 2 * 3",
        );

        TaskUtils.assertIsParseStageParseError(task);
        expect(task.error.innerError).to.be.instanceOf(Parser.ParseError.ExpectedAnyTokenKindError);
        expect(task.parseState.tokenIndex).to.equal(3);
        expect(reductions(task.nodeIdMapCollection)).to.deep.equal([["*", 4, 6]]);
    });

    it("attaches only left/operator before a right validator fallback and rewinds after the operator", async () => {
        const fixture: ReductionFixture = await prepare("1 as number");

        const invalidInput: OperatorsAndOperands = {
            ...fixture.input,
            operatorConstants: [
                {
                    ...ArrayUtils.assertGet(fixture.input.operatorConstants, 0),
                    constantKind: Constant.KeywordConstant.Meta,
                },
            ],
        };

        const marker: Error = new Error("right operand fallback");
        const original: typeof NaiveParseSteps.readUnaryExpression = NaiveParseSteps.readUnaryExpression;

        Object.defineProperty(NaiveParseSteps, "readUnaryExpression", {
            configurable: true,
            value: (): Promise<Ast.TUnaryExpression> => Promise.reject(marker),
        });

        try {
            await rejects(reduce({ ...fixture, input: invalidInput }), (error: unknown) => error === marker);
        } finally {
            Object.defineProperty(NaiveParseSteps, "readUnaryExpression", { configurable: true, value: original });
        }

        const { state }: ReductionFixture = fixture;
        const partial: Parser.ParseContext.TNode = Assert.asDefined(state.currentContextNode);
        expect(state.tokenIndex).to.equal(2);
        expect(state.currentToken).to.equal(state.lexerSnapshot.tokens[2]);
        expect(partial.kind).to.equal(Ast.NodeKind.MetadataExpression);
        expect(partial.attributeCounter).to.equal(2);

        expect(state.contextState.nodeIdMapCollection.childIdsById.get(partial.id)).to.deep.equal([
            ArrayUtils.assertGet(invalidInput.operands, 0).id,
            ArrayUtils.assertGet(invalidInput.operatorConstants, 0).id,
        ]);

        expect(
            state.contextState.nodeIdMapCollection.astNodeById.has(ArrayUtils.assertGet(invalidInput.operands, 1).id),
        ).to.equal(false);
    });

    it("polls cancellation during preparation and after substantial reduction without advancing the cursor", async () => {
        const count: number = 256;

        for (const cancelAt of [32, count + 33]) {
            // eslint-disable-next-line no-await-in-loop
            const fixture: ReductionFixture = await prepare(
                Array(count + 1)
                    .fill("1")
                    .join(" + "),
            );

            const originalCurrentToken: Language.Token.Token | undefined = fixture.state.currentToken;
            let polls: number = 0;
            const marker: Error = new Error("cancel reduction");

            const state: Parser.ParseState = {
                ...fixture.state,
                cancellationToken: {
                    cancel: (): void => {
                        polls = cancelAt;
                    },
                    isCancelled: (): boolean => polls >= cancelAt,
                    throwIfCancelled: (): void => {
                        polls += 1;

                        if (polls === cancelAt) {
                            throw marker;
                        }
                    },
                },
            };

            // eslint-disable-next-line no-await-in-loop
            await rejects(reduce({ ...fixture, state }), (error: unknown) => error === marker);
            expect(polls).to.equal(cancelAt);
            const completed: number = Math.max(0, cancelAt - count - 1);
            expect(reductions(state.contextState.nodeIdMapCollection)).to.have.length(completed);
            expect(state.tokenIndex).to.equal(completed === 0 ? count * 2 + 1 : completed * 2 + 1);

            expect(state.currentToken).to.equal(
                completed === 0 ? originalCurrentToken : state.lexerSnapshot.tokens[state.tokenIndex],
            );
        }
    });

    it("charges preparation and reductions to the shared speculative budget and stops before mutation", async () => {
        const fixture: ReductionFixture = await prepare("1 + 2 * 3 - 4 / 5");
        const count: number = fixture.input.operatorConstants.length;
        fixture.state.speculativeWorkBudget = { limit: count + 1, remaining: count + 1, depth: 1 };
        await rejects(reduce(fixture), Parser.ParseError.SpeculativeWorkLimitExceededError);
        expect(fixture.state.speculativeWorkBudget.remaining).to.equal(0);
        expect(fixture.state.speculativeWorkBudget.depth).to.equal(1);
        expect(reductions(fixture.state.contextState.nodeIdMapCollection)).to.deep.equal([["*", 2, 4]]);
        expect(fixture.state.tokenIndex).to.equal(5);
        expect(fixture.state.currentToken).to.equal(fixture.state.lexerSnapshot.tokens[5]);
    });

    it("performs linear indexed work for equal and alternating precedence chains", async () => {
        for (const count of [128, 512]) {
            for (const alternating of [false, true]) {
                const text: string = `${Array.from({ length: count }, (_: unknown, index: number) =>
                    alternating && index % 2 === 0 ? "1 * " : "1 + ",
                ).join("")}1`;

                // eslint-disable-next-line no-await-in-loop
                const fixture: ReductionFixture = await prepare(text);

                fixture.state.speculativeWorkBudget = { limit: count * 2, remaining: count * 2, depth: 1 };
                Object.freeze(fixture.input.operands);
                Object.freeze(fixture.input.operatorConstants);
                let indexedReads: number = 0;
                let slicedElements: number = 0;
                const original: typeof ArrayUtils.assertGet = ArrayUtils.assertGet;
                const originalSlice: typeof Array.prototype.slice = Array.prototype.slice;

                Object.defineProperty(ArrayUtils, "assertGet", {
                    configurable: true,
                    value: <T>(array: ReadonlyArray<T>, index: number): T => {
                        indexedReads += 1;

                        return original(array, index);
                    },
                });

                Object.defineProperty(Array.prototype, "slice", {
                    configurable: true,
                    value<T>(this: T[], start?: number, end?: number): T[] {
                        const result: T[] = originalSlice.call(this, start, end);
                        slicedElements += result.length;

                        return result;
                    },
                });

                try {
                    // eslint-disable-next-line no-await-in-loop
                    const result: TOperand = await reduce(fixture);
                    expect(result.tokenRange.tokenIndexStart).to.equal(0);
                    expect(result.tokenRange.tokenIndexEnd).to.equal(count * 2);
                    expect(indexedReads).to.be.at.most(count * 4 + 1);
                    expect(slicedElements).to.be.at.most(count * 4);
                    expect(fixture.state.speculativeWorkBudget.remaining).to.equal(0);
                    expect(reductions(fixture.state.contextState.nodeIdMapCollection)).to.have.length(count);
                } finally {
                    Object.defineProperty(ArrayUtils, "assertGet", { configurable: true, value: original });
                    Object.defineProperty(Array.prototype, "slice", { configurable: true, value: originalSlice });
                }
            }
        }
    });
});
