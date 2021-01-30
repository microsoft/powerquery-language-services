// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { Position } from "../../commonTypes";

export interface LineTokenWithPosition extends PQP.Language.Token.LineToken, Position {
    readonly tokenIndex: number;
}
