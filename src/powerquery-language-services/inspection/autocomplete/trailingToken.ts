// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { TokenPositionComparison } from "../../tokenPositionComparison";

// A ParseError includes the token it failed to parse.
// This is that token plus a flag for where it is in relation to a Position.
export interface TrailingToken extends PQP.Language.Token.Token {
    readonly isPositionInToken: boolean;
    readonly tokenStartComparison: TokenPositionComparison;
    readonly tokenEndComparison: TokenPositionComparison;
}
