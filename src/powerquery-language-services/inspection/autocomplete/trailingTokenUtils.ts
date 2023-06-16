// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { PositionUtils } from "../..";
import { TrailingToken } from "./trailingToken";

export function createTrailingToken(position: Position, parseErrorToken: PQP.Language.Token.Token): TrailingToken {
    const isPositionInToken: boolean = PositionUtils.isInToken(position, parseErrorToken, false, true);

    return {
        ...parseErrorToken,
        isPositionInToken,
        tokenStartComparison: PositionUtils.compareTokenPosition(position, parseErrorToken.positionStart),
        tokenEndComparison: PositionUtils.compareTokenPosition(position, parseErrorToken.positionEnd),
    };
}
