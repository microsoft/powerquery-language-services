// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { Mock, mock } from "node:test";
import { expect } from "chai";

import {
    CommonError,
    CounterCancellationToken,
    DefaultSettings,
    ICancellationToken,
    Lexer,
    Parser,
    Result,
    ResultUtils,
    Settings,
    Task,
    TaskUtils,
    TimedCancellationToken,
} from "../../../src";

function assertGetCancellationError<T, E>(tried: Result<T, E>): CommonError.CancellationError {
    ResultUtils.assertIsError(tried);

    if (!CommonError.isCommonError(tried.error)) {
        throw new Error(`expected error to be a ${CommonError.CommonError.name}`);
    }

    const innerError: Error = tried.error.innerError;

    if (!(innerError instanceof CommonError.CancellationError)) {
        throw new Error(`expected innerError to be a ${CommonError.CancellationError.name}`);
    }

    return innerError;
}

function defaultSettingsWithExpiredCancellationToken(): Settings {
    return {
        ...DefaultSettings,
        cancellationToken: new TimedCancellationToken(0),
    };
}

describe("CancellationToken", () => {
    it("shares a five-second deadline across lexing and parsing, renewed on the next call", async () => {
        let now: number = 0;
        const clock: Mock<typeof Date.now> = mock.method(Date, "now", () => now);

        const settings: Settings = {
            ...DefaultSettings,
            newParseState: (snapshot: Lexer.LexerSnapshot, overrides?: Partial<Parser.ParseState>) => {
                now += 1;

                return DefaultSettings.newParseState(snapshot, overrides);
            },
        };

        try {
            const first: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, "1");
            TaskUtils.assertIsParseStageOk(first);
            const token: ICancellationToken | undefined = first.parseState.cancellationToken;
            expect(token?.isCancelled()).to.be.false;
            now = 4_999;
            expect(token?.isCancelled()).to.be.false;
            now = 5_000;
            expect(() => token?.throwIfCancelled()).to.throw(CommonError.CancellationError);

            const second: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, "2");
            TaskUtils.assertIsParseStageOk(second);
            expect(second.parseState.cancellationToken?.isCancelled()).to.be.false;
        } finally {
            clock.mock.restore();
        }
    });

    it("reports a parse-stage timeout as a cancellation result", async () => {
        let now: number = 0;
        const clock: Mock<typeof Date.now> = mock.method(Date, "now", () => now);

        const settings: Settings = {
            ...DefaultSettings,
            newParseState: (snapshot: Lexer.LexerSnapshot, overrides?: Partial<Parser.ParseState>) => {
                now += 5_000;

                return DefaultSettings.newParseState(snapshot, overrides);
            },
        };

        try {
            const result: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, "1");
            TaskUtils.assertIsParseStageCommonError(result);
            expect(result.error.innerError).to.be.instanceOf(CommonError.CancellationError);
        } finally {
            clock.mock.restore();
        }
    });

    describe(`CounterCancellationToken`, () => {
        it(`throwIfCancelled should consume exactly 1 count`, () => {
            // With threshold of 3, we should be able to call throwIfCancelled 2 times
            // without throwing (counts 1 and 2), then the 3rd should throw (count 3).
            const token: CounterCancellationToken = new CounterCancellationToken(3);

            // First call: counter goes to 1, threshold is 3, no throw
            token.throwIfCancelled();

            // Second call: counter goes to 2, threshold is 3, no throw
            token.throwIfCancelled();

            // Third call: counter goes to 3, threshold is 3, should throw
            expect(() => token.throwIfCancelled()).to.throw(CommonError.CancellationError);
        });

        it(`isCancelled should consume exactly 1 count`, () => {
            const token: CounterCancellationToken = new CounterCancellationToken(3);

            // First call: counter goes to 1, not cancelled
            expect(token.isCancelled()).to.be.false;

            // Second call: counter goes to 2, not cancelled
            expect(token.isCancelled()).to.be.false;

            // Third call: counter goes to 3, cancelled
            expect(token.isCancelled()).to.be.true;
        });
    });

    describe(`lexer`, () => {
        it(`Lexer.tryLex`, () => {
            const triedLex: Lexer.TriedLex = Lexer.tryLex(defaultSettingsWithExpiredCancellationToken(), "foo");
            assertGetCancellationError(triedLex);
        });

        for (const text of ["", " ", "\r\n", "/*unfinished", '"unfinished', "#bad"]) {
            it(`honors pre-cancellation for ${JSON.stringify(text)}`, () => {
                const triedLex: Lexer.TriedLex = Lexer.tryLex(defaultSettingsWithExpiredCancellationToken(), text);
                assertGetCancellationError(triedLex);
            });
        }

        for (const text of ["a b c d", '"a\nb\nc"', '#"a\nb\nc"', "/*a\nb\nc*/", "\n\n\n\n"]) {
            it(`checks cancellation while scanning ${JSON.stringify(text)}`, () => {
                const triedLex: Lexer.TriedLex = Lexer.tryLex(
                    { ...DefaultSettings, cancellationToken: new CounterCancellationToken(4) },
                    text,
                );

                assertGetCancellationError(triedLex);
            });
        }
    });
});
