// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, Range } from "../commonTypes";
import { LineTokenAtPosition } from "./lineTokenAtPosition";

export function getTokenAtPosition(
    lineTokens: ReadonlyArray<PQP.Language.Token.LineToken>,
    position: Position,
): LineTokenAtPosition | undefined {
    const numTokens: number = lineTokens.length;

    for (let index: number = 0; index < numTokens; index += 1) {
        const token: PQP.Language.Token.LineToken = lineTokens[index];
        if (token.positionStart < position.character && token.positionEnd >= position.character) {
            return {
                ...token,
                ...position,
                tokenIndex: 0,
            };
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
