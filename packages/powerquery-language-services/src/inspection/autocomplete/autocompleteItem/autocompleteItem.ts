// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem } from "vscode-languageserver-types";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export interface AutocompleteItem extends CompletionItem {
    readonly jaroWinklerScore: number;
    readonly powerQueryType: Type.TPowerQueryType;
}
