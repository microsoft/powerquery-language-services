// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, Range } from "./commonTypes";

export function getTokenAtPosition(
    lineTokens: ReadonlyArray<PQP.Language.Token.LineToken>,
    position: Position,
): PQP.Language.Token.LineToken | undefined {
    for (const token of lineTokens) {
        if (token.positionStart < position.character && token.positionEnd >= position.character) {
            return token;
        }
    }

    return undefined;
}

export function getTokenRangeForPosition(token: PQP.Language.Token.LineToken, cursorPosition: Position): Range {
    return {
        start: {
            line: cursorPosition.line,
            character: token.positionStart,
        },
        end: {
            line: cursorPosition.line,
            character: token.positionEnd,
        },
    };
}
