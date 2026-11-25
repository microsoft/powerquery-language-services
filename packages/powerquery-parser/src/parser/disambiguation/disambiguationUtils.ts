// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AmbiguousParse,
    BracketDisambiguation,
    DismabiguationBehavior,
    ParenthesisDisambiguation,
    TAmbiguousBracketNode,
    TAmbiguousParenthesisNode,
} from "./disambiguation";
import { ArrayUtils, Assert, CommonError, Result, ResultUtils } from "../../common";
import { Ast, AstUtils, Constant, Token } from "../../language";
import { Parser, ParseStateCheckpoint } from "../parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { Trace, TraceConstant } from "../../common/trace";
import { LexerSnapshot } from "../../lexer";
import { NodeIdMapUtils } from "../nodeIdMap";
import { ParseError } from "..";

const parenthesisMatches: WeakMap<LexerSnapshot, Map<number, number>> = new WeakMap();

function matchingParenthesis(state: ParseState): number | undefined {
    state.cancellationToken?.throwIfCancelled();
    const snapshot: LexerSnapshot = state.lexerSnapshot;
    let matches: Map<number, number> | undefined = parenthesisMatches.get(snapshot);

    if (matches === undefined) {
        matches = new Map();
        parenthesisMatches.set(snapshot, matches);
    }

    const cached: number | undefined = matches.get(state.tokenIndex);

    if (cached !== undefined) {
        if (state.speculativeWorkBudget.depth > 0) {
            // Unmatched lookahead still bounds speculative descent before it allocates a deep partial tree.
            ParseStateUtils.consumeSpeculativeWork(
                state,
                cached === -1 ? Math.max(1, snapshot.tokens.length - state.tokenIndex - 1) : 1,
            );
        }

        return cached === -1 ? undefined : cached;
    }

    const openers: number[] = [state.tokenIndex];

    for (let index: number = state.tokenIndex + 1; index < snapshot.tokens.length; index += 1) {
        state.cancellationToken?.throwIfCancelled();

        if (state.speculativeWorkBudget.depth > 0) {
            ParseStateUtils.consumeSpeculativeWork(state);
        }

        const kind: Token.TokenKind = ArrayUtils.assertGet(snapshot.tokens, index).kind;

        if (kind === Token.TokenKind.LeftParenthesis) {
            openers.push(index);
        } else if (kind === Token.TokenKind.RightParenthesis) {
            const opener: number = Assert.asDefined(openers.pop());
            matches.set(opener, index);

            if (openers.length === 0) {
                return index;
            }
        }
    }

    for (const opener of openers) {
        state.cancellationToken?.throwIfCancelled();
        matches.set(opener, -1);
    }

    return undefined;
}

// Try alternatives in place, keeping only their scores. Replay the winner if it wasn't last.
// Prefer the most tokens consumed, then success, then callback order.
export async function readAmbiguous<T extends Ast.TNode>(
    state: ParseState,
    parser: Parser,
    parseCallbacks: ReadonlyArray<(state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<T>>,
    correlationId: number | undefined,
): Promise<AmbiguousParse<T>> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguous.name,
        correlationId,
        {
            [TraceConstant.Length]: parseCallbacks.length,
        },
    );

    ArrayUtils.assertNonZeroLength(parseCallbacks, "requires at least one parse function");

    const checkpoint: ParseStateCheckpoint = await parser.checkpoint(state);
    let bestIndex: number = 0;
    let bestTokenIndex: number = -1;
    let bestIsOk: boolean = false;

    async function attempt(index: number): Promise<Result<T, ParseError.ParseError>> {
        ParseStateUtils.consumeSpeculativeWork(state);
        state.speculativeWorkBudget.depth += 1;

        try {
            return ResultUtils.ok(await ArrayUtils.assertGet(parseCallbacks, index)(state, parser, trace.id));
        } catch (error: unknown) {
            Assert.isInstanceofError(error);
            CommonError.throwIfCancellationError(error);

            if (ParseError.isSpeculativeWorkLimitExceeded(error)) {
                throw error;
            }

            if (ParseError.isParseError(error)) {
                return ResultUtils.error(error);
            } else if (ParseError.isTInnerParseError(error)) {
                return ResultUtils.error(new ParseError.ParseError(error, state));
            }

            throw error;
        } finally {
            state.speculativeWorkBudget.depth -= 1;
        }
    }

    for (let index: number = 0; index < parseCallbacks.length; index += 1) {
        if (index > 0) {
            // eslint-disable-next-line no-await-in-loop
            await parser.restoreCheckpoint(state, checkpoint);
        }

        // eslint-disable-next-line no-await-in-loop
        const result: Result<T, ParseError.ParseError> = await attempt(index);
        const isOk: boolean = ResultUtils.isOk(result);

        if (state.tokenIndex > bestTokenIndex || (state.tokenIndex === bestTokenIndex && isOk && !bestIsOk)) {
            bestIndex = index;
            bestTokenIndex = state.tokenIndex;
            bestIsOk = isOk;
        }

        if (index === parseCallbacks.length - 1 && bestIndex === index) {
            trace.exit();

            return { parseState: state, result };
        }
    }

    await parser.restoreCheckpoint(state, checkpoint);
    const result: Result<T, ParseError.ParseError> = await attempt(bestIndex);
    trace.exit();

    return { parseState: state, result };
}

// Peeks at the token stream and either performs an explicit read or an ambiguous read.
export async function readAmbiguousBracket(
    state: ParseState,
    parser: Parser,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
    correlationId: number | undefined,
): Promise<TAmbiguousBracketNode> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguousBracket.name,
        correlationId,
    );

    // We might be able to peek at tokens to disambiguate what bracketed expression is next.
    const disambiguation: BracketDisambiguation | undefined = disambiguateBracket(state, allowedVariants, trace.id);

    // Peeking gave us a concrete answer as to what's next.
    let ambiguousBracket: TAmbiguousBracketNode;

    if (disambiguation !== undefined) {
        switch (disambiguation) {
            case BracketDisambiguation.FieldProjection:
                ambiguousBracket = await parser.readFieldProjection(state, parser, trace.id);
                break;

            case BracketDisambiguation.FieldSelection:
                ambiguousBracket = await parser.readFieldSelection(state, parser, trace.id);
                break;

            case BracketDisambiguation.RecordExpression:
                ambiguousBracket = await parser.readRecordExpression(state, parser, trace.id);
                break;

            default:
                throw Assert.isNever(disambiguation);
        }
    }
    // Else we branch on `IParseState.disambiguousBehavior`.
    else {
        switch (state.disambiguationBehavior) {
            case DismabiguationBehavior.Strict:
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw ParseStateUtils.unterminatedBracketError(state);

            case DismabiguationBehavior.Thorough:
                ambiguousBracket = await thoroughReadAmbiguousBracket(state, parser, allowedVariants, trace.id);
                break;

            default:
                throw Assert.isNever(state.disambiguationBehavior);
        }
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return ambiguousBracket;
}

// Peeks at the token stream and either performs an explicit read or an ambiguous read.
export async function readAmbiguousParenthesis(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<TAmbiguousParenthesisNode> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguousParenthesis.name,
        correlationId,
    );

    // We might be able to peek at tokens to disambiguate what parenthesized expression is next.
    const disambiguation: ParenthesisDisambiguation | undefined = await disambiguateParenthesis(
        state,
        parser,
        trace.id,
    );

    // Peeking gave us a concrete answer as to what's next.
    let ambiguousParenthesis: TAmbiguousParenthesisNode;

    if (disambiguation !== undefined) {
        switch (disambiguation) {
            case ParenthesisDisambiguation.FunctionExpression:
                ambiguousParenthesis = await parser.readFunctionExpression(state, parser, trace.id);
                break;

            case ParenthesisDisambiguation.ParenthesizedExpression:
                ambiguousParenthesis = await readParenthesizedExpressionOrBinOpExpression(state, parser, trace.id);
                break;

            default:
                throw Assert.isNever(disambiguation);
        }
    }
    // Else we branch on `IParseState.disambiguousBehavior`.
    else {
        switch (state.disambiguationBehavior) {
            case DismabiguationBehavior.Strict:
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw ParseStateUtils.unterminatedParenthesesError(state);

            case DismabiguationBehavior.Thorough:
                ambiguousParenthesis = await thoroughReadAmbiguousParenthesis(state, parser, trace.id);
                break;

            default:
                trace.exit({ [TraceConstant.IsThrowing]: true });

                throw Assert.isNever(state.disambiguationBehavior);
        }
    }

    trace.exit({ [TraceConstant.IsThrowing]: false });

    return ambiguousParenthesis;
}

// Peeks at tokens which might give a concrete disambiguation.
export async function disambiguateParenthesis(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<ParenthesisDisambiguation | undefined> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        disambiguateParenthesis.name,
        correlationId,
    );

    const offsetTokenIndex: number | undefined = matchingParenthesis(state);

    if (offsetTokenIndex !== undefined) {
        let disambiguation: ParenthesisDisambiguation;

        // '(x as number) as number' can be either case; inspect the token after the return type.
        if (ParseStateUtils.isTokenKind(state, Token.TokenKind.KeywordAs, offsetTokenIndex + 1)) {
            const checkpoint: ParseStateCheckpoint = await parser.checkpoint(state);
            ParseStateUtils.consumeSpeculativeWork(state);
            unsafeMoveTo(state, offsetTokenIndex + 2);

            try {
                await parser.readNullablePrimitiveType(state, parser, trace.id);
            } catch (error: unknown) {
                Assert.isInstanceofError(error);
                CommonError.throwIfCancellationError(error);

                if (ParseError.isSpeculativeWorkLimitExceeded(error) || !ParseError.isTInnerParseError(error)) {
                    throw error;
                }

                await parser.restoreCheckpoint(state, checkpoint);

                if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                    return ParenthesisDisambiguation.FunctionExpression;
                } else {
                    return ParenthesisDisambiguation.ParenthesizedExpression;
                }
            }

            if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                disambiguation = ParenthesisDisambiguation.FunctionExpression;
            } else {
                disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
            }

            await parser.restoreCheckpoint(state, checkpoint);
        } else if (ParseStateUtils.isTokenKind(state, Token.TokenKind.FatArrow, offsetTokenIndex + 1)) {
            disambiguation = ParenthesisDisambiguation.FunctionExpression;
        } else {
            disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
        }

        if (disambiguation) {
            trace.exit({ [TraceConstant.Result]: disambiguation });

            return disambiguation;
        }
    }

    trace.exit({ [TraceConstant.Result]: undefined });

    return undefined;
}

export function disambiguateBracket(
    state: ParseState,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
    correlationId: number | undefined,
): BracketDisambiguation | undefined {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        disambiguateBracket.name,
        correlationId,
    );

    let offsetTokenIndex: number = state.tokenIndex + 1;
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    const offsetToken: Token.Token | undefined = tokens[offsetTokenIndex];

    if (offsetToken === undefined) {
        return undefined;
    }

    let offsetTokenKind: Token.TokenKind = offsetToken.kind;
    let result: BracketDisambiguation | undefined;

    if (offsetTokenKind === Token.TokenKind.LeftBracket) {
        result = BracketDisambiguation.FieldProjection;
    } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
        result = BracketDisambiguation.RecordExpression;
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;

        while (offsetTokenIndex < totalTokens) {
            state.cancellationToken?.throwIfCancelled();

            if (state.speculativeWorkBudget.depth > 0) {
                ParseStateUtils.consumeSpeculativeWork(state);
            }

            offsetTokenKind = ArrayUtils.assertGet(tokens, offsetTokenIndex).kind;

            if (offsetTokenKind === Token.TokenKind.Equal) {
                result = BracketDisambiguation.RecordExpression;
                break;
            } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
                result = BracketDisambiguation.FieldSelection;
                break;
            }

            offsetTokenIndex += 1;
        }
    }

    trace.exit({ [TraceConstant.Result]: result });

    return result !== undefined && allowedVariants.includes(result) ? result : undefined;
}

const enum DisambiguationTraceConstant {
    Disambiguation = "Disambiguation",
}

// Checkpoint the current state and attempt to read for each of the following:
//  FieldProjection, FieldSelection, and RecordExpression.
// Mutates the given state with the read attempt which matched the most tokens.
async function thoroughReadAmbiguousBracket(
    state: ParseState,
    parser: Parser,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
    correlationId: number | undefined,
): Promise<TAmbiguousBracketNode> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readAmbiguousBracket.name,
        correlationId,
    );

    const ambiguousBracket: TAmbiguousBracketNode = await thoroughReadAmbiguous(
        state,
        parser,
        bracketDisambiguationParseFunctions(parser, allowedVariants),
        trace.id,
    );

    trace.exit({ allowedVariants });

    return ambiguousBracket;
}

// Checkpoint the current state and attempt to read for each of the following:
//  FunctionExpression, ParenthesisExpression.
// Mutates the given state with the read attempt which matched the most tokens.
function thoroughReadAmbiguousParenthesis(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<TAmbiguousParenthesisNode> {
    return thoroughReadAmbiguous<TAmbiguousParenthesisNode>(
        state,
        parser,
        [parser.readFunctionExpression, readParenthesizedExpressionOrBinOpExpression],
        correlationId,
    );
}

async function thoroughReadAmbiguous<T extends TAmbiguousBracketNode | TAmbiguousParenthesisNode>(
    state: ParseState,
    parser: Parser,
    parseFns: ReadonlyArray<(state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<T>>,
    correlationId: number | undefined,
): Promise<T> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        thoroughReadAmbiguous.name,
        correlationId,
        {
            [TraceConstant.Length]: parseFns.length,
        },
    );

    const ambiguousParse: AmbiguousParse<T> = await readAmbiguous(state, parser, parseFns, trace.id);

    if (ResultUtils.isOk(ambiguousParse.result)) {
        trace.exit({
            [TraceConstant.IsThrowing]: false,
            [TraceConstant.Result]: ambiguousParse.result,
        });

        return ambiguousParse.result.value;
    } else {
        trace.exit({ [TraceConstant.IsThrowing]: true });

        throw ambiguousParse.result.error;
    }
}

// Converts BracketDisambiguation into its corresponding read function.
function bracketDisambiguationParseFunctions(
    parser: Parser,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): ReadonlyArray<
    (state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<TAmbiguousBracketNode>
> {
    return allowedVariants.map((bracketDisambiguation: BracketDisambiguation) => {
        switch (bracketDisambiguation) {
            case BracketDisambiguation.FieldProjection:
                return parser.readFieldProjection;

            case BracketDisambiguation.FieldSelection:
                return parser.readFieldSelection;

            case BracketDisambiguation.RecordExpression:
                return parser.readRecordExpression;

            default:
                throw Assert.isNever(bracketDisambiguation);
        }
    });
}

// When the next token is an open parenthesis we can't directly read
// a ParenthesisExpression as it may leave trailing tokens behind.
// `(1) + 2`
async function readParenthesizedExpressionOrBinOpExpression(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.ParenthesizedExpression | Ast.TLogicalExpression> {
    const trace: Trace = state.traceManager.entry(
        DisambiguationTraceConstant.Disambiguation,
        readParenthesizedExpressionOrBinOpExpression.name,
        correlationId,
    );

    const node: Ast.TNode = await parser.readLogicalExpression(state, parser, trace.id);

    const leftMostNode: Ast.TNode = NodeIdMapUtils.assertLeftMostLeaf(state.contextState.nodeIdMapCollection, node.id);

    AstUtils.assertAsNodeKind<Ast.TConstant>(leftMostNode, Ast.NodeKind.Constant);

    Assert.isTrue(
        leftMostNode.kind === Ast.NodeKind.Constant &&
            leftMostNode.constantKind === Constant.WrapperConstant.LeftParenthesis,
        `leftMostNode should be a ${Ast.NodeKind.Constant} with a constantKind of ${Constant.WrapperConstant.LeftParenthesis}`,
    );

    trace.exit();

    return node;
}

// WARNING: Only updates tokenIndex and currentTokenKind,
//          Manual cleanup of other state fields such as TokenRangeStack is assumed by the caller.
function unsafeMoveTo(state: ParseState, tokenIndex: number): void {
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    state.tokenIndex = tokenIndex;

    if (tokenIndex < tokens.length) {
        state.currentToken = ArrayUtils.assertGet(tokens, tokenIndex);
        state.currentTokenKind = state.currentToken.kind;
    } else {
        state.currentToken = undefined;
        state.currentTokenKind = undefined;
    }
}
