// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { PositionUtils } from "../..";
import { TrailingTokenPositionComparison, TrailingToken } from "./trailingToken";
import { TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export function createTrailingToken(position: Position, parseErrorToken: PQP.Language.Token.Token): TrailingToken {
    const isPositionInToken: boolean = PositionUtils.isInToken(position, parseErrorToken, false, true);

    const regularIdentifierUnderPosition: string | undefined =
        isPositionInToken && parseErrorToken.data && TextUtils.isRegularIdentifier(parseErrorToken.data, true)
            ? parseErrorToken.data
            : undefined;

    return {
        ...parseErrorToken,
        isPositionInToken,
        tokenStartComparison: comparePosition(position, parseErrorToken.positionStart),
        tokenEndComparison: comparePosition(position, parseErrorToken.positionEnd),
        regularIdentifierUnderPosition,
    };
}

function comparePosition(
    position: Position,
    tokenPosition: PQP.Language.Token.TokenPosition,
): TrailingTokenPositionComparison {
    if (PositionUtils.isOnTokenPosition(position, tokenPosition)) {
        return TrailingTokenPositionComparison.OnToken;
    } else if (PositionUtils.isAfterTokenPosition(position, tokenPosition, false)) {
        return TrailingTokenPositionComparison.RightOfToken;
    } else if (PositionUtils.isBeforeTokenPosition(position, tokenPosition, false)) {
        return TrailingTokenPositionComparison.LeftOfToken;
    } else {
        throw new PQP.CommonError.InvariantError("position is not on, after, or before tokenPosition", {
            position,
            tokenPosition,
        });
    }
}
