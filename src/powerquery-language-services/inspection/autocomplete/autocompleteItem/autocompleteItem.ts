// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItem } from "vscode-languageserver-types";

export interface AutocompleteItem extends CompletionItem {
    readonly jaroWinklerScore: number;
    readonly powerQueryType: PQP.Language.Type.TPowerQueryType;
}
