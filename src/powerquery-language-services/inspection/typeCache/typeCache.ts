// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { ScopeById } from "../scope";

export type TypeById = Map<number, PQP.Language.Type.PqType>;

// A cache that can be re-used for successive calls under the same document.
export interface TypeCache {
    readonly scopeById: ScopeById;
    readonly typeById: TypeById;
}
