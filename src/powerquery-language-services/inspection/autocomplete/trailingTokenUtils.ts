// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { PositionUtils, TokenPositionComparison } from "../..";
import { TrailingToken } from "./trailingToken";

export function createTrailingToken(position: Position, parseErrorToken: PQP.Language.Token.Token): TrailingToken {
    const tokenStartComparison: TokenPositionComparison = PositionUtils.compareTokenPosition(
        position,
        parseErrorToken.positionStart,
    );

    const tokenEndComparison: TokenPositionComparison = PositionUtils.compareTokenPosition(
        position,
        parseErrorToken.positionEnd,
    );

    return {
        ...parseErrorToken,
        isPositionInToken: PositionUtils.isInToken(position, parseErrorToken, false, true),
        tokenStartComparison,
        tokenEndComparison,
        // This is another way of saying:
        //  - startComparison is OnToken or RightOfToken
        //  - endComparison is OnToken or LeftOfToken
        isPositionEitherInOrOnToken:
            tokenStartComparison !== TokenPositionComparison.LeftOfToken &&
            tokenEndComparison !== TokenPositionComparison.RightOfToken,
    };
}
