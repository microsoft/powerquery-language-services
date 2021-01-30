// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, Range } from "../../commonTypes";
import { LineTokenWithPosition } from "./lineTokenWithPosition";

export function maybeFrom(
    position: Position,
    lineTokens: ReadonlyArray<PQP.Language.Token.LineToken>,
): LineTokenWithPosition | undefined {
    const numTokens: number = lineTokens.length;

    for (let tokenIndex: number = 0; tokenIndex < numTokens; tokenIndex += 1) {
        const token: PQP.Language.Token.LineToken = lineTokens[tokenIndex];
        if (token.positionStart < position.character && token.positionEnd >= position.character) {
            return {
                ...token,
                ...position,
                tokenIndex,
            };
        }
    }

    return undefined;
}

export function tokenRange(lineTokenWithPosition: LineTokenWithPosition): Range {
    return {
        start: {
            line: lineTokenWithPosition.line,
            character: lineTokenWithPosition.positionStart,
        },
        end: {
            line: lineTokenWithPosition.line,
            character: lineTokenWithPosition.positionEnd,
        },
    };
}
