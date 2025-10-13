// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { type TypeCache } from "./typeCache";

// A cache that can be re-used for successive calls under the same document.
export function emptyCache(): TypeCache {
    return {
        scopeById: new Map(),
        typeById: new Map(),
    };
}
