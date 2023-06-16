// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import type { Position } from "vscode-languageserver-types";

import { PositionUtils } from "../..";
import { TrailingToken } from "./trailingToken";
import { TextUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export function createTrailingToken(position: Position, parseErrorToken: PQP.Language.Token.Token): TrailingToken {
    const isInOrOnPosition: boolean = PositionUtils.isInToken(position, parseErrorToken, false, true);

    const regularIdentifierUnderPosition: string | undefined =
        isInOrOnPosition && parseErrorToken.data && TextUtils.isRegularIdentifier(parseErrorToken.data, true)
            ? parseErrorToken.data
            : undefined;

    return {
        ...parseErrorToken,
        isInOrOnPosition,
        regularIdentifierUnderPosition,
    };
}
