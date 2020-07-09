// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, Range } from "./commonTypes";

export function getTokenAtPosition(
    lineTokens: ReadonlyArray<PQP.Language.LineToken>,
    position: Position,
    getTextCallback: (range?: Range) => string,
): PQP.Language.LineToken | undefined {
    for (const token of lineTokens) {
        if (token.positionStart <= position.character && token.positionEnd >= position.character) {
            return token;
        }
    }

    // TODO: is this still needed with the latest parser?
    // Token wasn't found - check for special case where current position is a trailing "." on an identifier
    const currentRange: Range = {
        start: {
            line: position.line,
            character: position.character - 1,
        },
        end: position,
    };

    if (getTextCallback(currentRange) === ".") {
        for (const token of lineTokens) {
            if (
                token.kind === PQP.Language.LineTokenKind.Identifier &&
                token.positionStart <= position.character - 1 &&
                token.positionEnd >= position.character - 1
            ) {
                // Use this token with an adjusted position
                return {
                    ...token,
                    data: `${token.data}.`,
                    positionEnd: token.positionEnd + 1,
                };
            }
        }
    }

    return undefined;
}

export function getTokenRangeForPosition(token: PQP.Language.LineToken, cursorPosition: Position): Range {
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
