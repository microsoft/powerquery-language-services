// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItemKind } from "vscode-languageserver-types";
import { calculateJaroWinkler } from "../../jaroWinkler";
import { AutocompleteItem } from "./autocompleteItem";

// export function create(
//     label: string,
//     jaroWinklerScore: number,
//     powerQueryType: PQP.Language.Type.PowerQueryType,
// ): AutocompleteItem {
//     return {
//         label,
//         jaroWinklerScore,
//         powerQueryType,
//     };
// }

// export function createFromJaroWinkler(
//     key: string,
//     other: string,
//     powerQueryType: PQP.Language.Type.PowerQueryType,
// ): AutocompleteItem {
//     return create(key, calculateJaroWinkler(key, other), powerQueryType);
// }

export function createFromKeywordKind(label: PQP.Language.Keyword.KeywordKind, maybeOther?: string): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: PQP.Language.Type.NotApplicableInstance,
    };
}

export function createFromLanguageConstantKind(
    label: PQP.Language.Constant.LanguageConstantKind,
    maybeOther?: string,
): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: PQP.Language.Type.NotApplicableInstance,
    };
}

export function createFromPrimitiveTypeConstantKind(
    label: PQP.Language.Constant.PrimitiveTypeConstantKind,
    maybeOther?: string,
): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Reference,
        label,
        powerQueryType: PQP.Language.TypeUtils.createPrimitiveType(
            false,
            PQP.Language.TypeUtils.typeKindFromPrimitiveTypeConstantKind(label),
        ),
    };
}
