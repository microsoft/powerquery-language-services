// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Keyword, Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { CompletionItemKind } from "vscode-languageserver-types";
import { XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import type { AutocompleteItem } from "./autocompleteItem";
import { calculateJaroWinkler } from "../../../jaroWinkler";
import { Inspection } from "../../..";
import { Library } from "../../../library";

export function fromKeywordKind(label: Keyword.KeywordKind, other?: string): AutocompleteItem {
    const jaroWinklerScore: number = other !== undefined ? calculateJaroWinkler(label, other) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: Type.NotApplicableInstance,
    };
}

export function fromLibraryDefinition(
    label: string,
    libraryDefinition: Library.TLibraryDefinition,
    other?: string,
): Inspection.AutocompleteItem {
    const jaroWinklerScore: number = other !== undefined ? calculateJaroWinkler(label, other) : 1;

    return {
        jaroWinklerScore,
        kind: libraryDefinition.completionItemKind,
        label,
        powerQueryType: libraryDefinition.asPowerQueryType,
    };
}

export function fromScopeItem(
    label: string,
    scopeItem: Inspection.TScopeItem,
    powerQueryType: Type.TPowerQueryType,
    other?: string,
): AutocompleteItem | undefined {
    switch (scopeItem.kind) {
        case Inspection.ScopeItemKind.LetVariable:
        case Inspection.ScopeItemKind.RecordField:
        case Inspection.ScopeItemKind.SectionMember:
            if (scopeItem.value === undefined) {
                return undefined;
            }

            break;

        case Inspection.ScopeItemKind.Each:
            return undefined;

        case Inspection.ScopeItemKind.Parameter: {
            break;
        }

        case Inspection.ScopeItemKind.Undefined: {
            if (XorNodeUtils.isContext(scopeItem.xorNode)) {
                return undefined;
            }

            break;
        }

        default:
            throw Assert.isNever(scopeItem);
    }

    const jaroWinklerScore: number = other !== undefined ? calculateJaroWinkler(label, other) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Variable,
        label,
        powerQueryType,
    };
}

export function comparer(left: AutocompleteItem, right: AutocompleteItem): number {
    const jaroWinklerScoreDiff: number = right.jaroWinklerScore - left.jaroWinklerScore;

    if (jaroWinklerScoreDiff !== 0) {
        return jaroWinklerScoreDiff;
    } else if (left.label < right.label) {
        return -1;
    } else if (left.label > right.label) {
        return 1;
    } else {
        return 0;
    }
}
