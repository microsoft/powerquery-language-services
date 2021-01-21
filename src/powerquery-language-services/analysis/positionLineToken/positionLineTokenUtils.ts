// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, Range } from "../../commonTypes";
import { PositionLineToken } from "./positionLineToken";

export function maybePositionLineToken(
    position: Position,
    lineTokens: ReadonlyArray<PQP.Language.Token.LineToken>,
): PositionLineToken | undefined {
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

export function positionTokenLineRange(cursorPosition: Position, token: PQP.Language.Token.LineToken): Range {
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
