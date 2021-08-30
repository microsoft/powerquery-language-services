// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { CompletionItem } from "vscode-languageserver-types";

export interface AutocompleteItem extends CompletionItem {
    readonly jaroWinklerScore: number;
    readonly powerQueryType: Type.TPowerQueryType;
}
