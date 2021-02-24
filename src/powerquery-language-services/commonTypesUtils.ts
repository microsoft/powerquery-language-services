// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Position, Range } from "./commonTypes";

export function rangeFromTokenRange(tokenRange: PQP.Language.Token.TokenRange): Range {
    return {
        start: positionFromTokenPosition(tokenRange.positionStart),
        end: positionFromTokenPosition(tokenRange.positionEnd),
    };
}

export function positionFromTokenPosition(tokenPosition: PQP.Language.Token.TokenPosition): Position {
    return {
        character: tokenPosition.lineCodeUnit,
        line: tokenPosition.lineNumber,
    };
}
