// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

import { ScopeById } from "../scope";

export type TypeById = Map<number, Type.TPowerQueryType>;

// Owns scope storage, completed scope inspections, and types for one immutable document/settings.
export interface TypeCache {
    readonly scopeById: ScopeById;
    readonly typeById: TypeById;
}
