// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { PositionUtils } from "../..";
import { TrailingToken } from "./commonTypes";

export function createTrailingToken(position: Position, parseErrorToken: PQP.Language.Token.Token): TrailingToken {
    return {
        ...parseErrorToken,
        isInOrOnPosition: PositionUtils.isInToken(position, parseErrorToken, false, true),
    };
}
