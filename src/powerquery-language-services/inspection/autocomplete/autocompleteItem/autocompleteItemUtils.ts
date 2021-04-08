// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItemKind, SymbolKind } from "vscode-languageserver-types";
import { Inspection } from "../../..";
import { calculateJaroWinkler } from "../../jaroWinkler";
import { TScopeItem } from "../../scope";
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
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: PQP.Language.TypeUtils.createPrimitiveType(
            false,
            PQP.Language.TypeUtils.typeKindFromPrimitiveTypeConstantKind(label),
        ),
    };
}

export function createFromFieldAccess(
    label: string,
    powerQueryType: PQP.Language.Type.PowerQueryType,
    maybeOther?: string,
): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    // If the key is a quoted identifier but doesn't need to be one then slice out the quote contents.
    const identifierKind: PQP.StringUtils.IdentifierKind = PQP.StringUtils.identifierKind(label, false);
    const normalizedLabel: string =
        identifierKind === PQP.StringUtils.IdentifierKind.Quote ? label.slice(2, -1) : label;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Field,
        label: normalizedLabel,
        powerQueryType,
    };
}

export function maybeCreateFromScopeItem(
    label: string,
    scopeItem: Inspection.TScopeItem,
    powerQueryType: PQP.Language.Type.PowerQueryType,
    maybeOther?: string,
): AutocompleteItem | undefined {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;
    let symbolKind: SymbolKind;
    let name: string;

    switch (scopeItem.kind) {
        case Inspection.ScopeItemKind.LetVariable:
        case Inspection.ScopeItemKind.RecordField:
        case Inspection.ScopeItemKind.SectionMember: {
            if (scopeItem.maybeValue === undefined) {
                return undefined;
            }

            name = scopeItem.isRecursive ? `@${label}` : label;
            symbolKind = SymbolKind.Variable;
            break;
        }

        case Inspection.ScopeItemKind.Each:
            return undefined;

        case Inspection.ScopeItemKind.Parameter: {
            name = label;
            symbolKind = SymbolKind.Variable;
            break;
        }

        case Inspection.ScopeItemKind.Undefined: {
            if (scopeItem.xorNode.kind !== PQP.Parser.XorNodeKind.Ast) {
                return undefined;
            }

            name = label;
            symbolKind = SymbolKind.Variable;
            break;
        }

        default:
            throw PQP.Assert.isNever(scopeItem);
    }

    return {
        jaroWinklerScore,
        label,
        powerQueryType,
    };
}
