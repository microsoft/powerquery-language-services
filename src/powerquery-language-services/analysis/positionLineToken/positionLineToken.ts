// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position } from "../../commonTypes";

export interface PositionLineToken extends PQP.Language.Token.LineToken, Position {
    readonly tokenIndex: number;
}
