// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ScopeById } from "../scope";

export type TypeById = Map<number, Type.TPowerQueryType>;

// A cache that can be re-used for successive calls for the same document.
export interface TypeCache {
    readonly scopeById: ScopeById;
    readonly typeById: TypeById;
}
