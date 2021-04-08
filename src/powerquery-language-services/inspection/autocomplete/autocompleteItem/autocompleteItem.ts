// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export interface AutocompleteItem {
    readonly key: string;
    readonly jaroWinklerScore: number;
    readonly powerQueryType: PQP.Language.Type.PowerQueryType;
}
