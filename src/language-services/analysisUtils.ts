// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, Range } from "./commonTypes";

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
