// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position, PositionUtils } from "../position";
import { TrailingToken } from "./commonTypes";

export function trailingTokenFactory(position: Position, parseErrorToken: PQP.Language.Token.Token): TrailingToken {
    return {
        ...parseErrorToken,
        isInOrOnPosition: PositionUtils.isInToken(position, parseErrorToken, false, true),
    };
}
