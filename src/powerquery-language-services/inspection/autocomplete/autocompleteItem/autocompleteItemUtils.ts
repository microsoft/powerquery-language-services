// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Constant, Keyword, Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";
import { Assert } from "@microsoft/powerquery-parser";
import { CompletionItemKind } from "vscode-languageserver-types";
import { XorNodeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/parser";

import type { AutocompleteItem } from "./autocompleteItem";
import { calculateJaroWinkler } from "../../../jaroWinkler";
import { Inspection } from "../../..";
import { Library } from "../../../library";

export function createFromFieldAccess(
    label: string,
    powerQueryType: Type.TPowerQueryType,
    maybeOther?: string,
): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    // If the key is a quoted identifier but doesn't need to be one then slice out the quote contents.
    const identifierKind: PQP.Language.TextUtils.IdentifierKind = PQP.Language.TextUtils.identifierKind(label, false);

    const normalizedLabel: string =
        identifierKind === PQP.Language.TextUtils.IdentifierKind.Quote ? label.slice(2, -1) : label;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Field,
        label: normalizedLabel,
        powerQueryType,
    };
}

export function createFromKeywordKind(label: Keyword.KeywordKind, maybeOther?: string): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: Type.NotApplicableInstance,
    };
}

export function createFromLanguageConstant(label: Constant.LanguageConstant, maybeOther?: string): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: Type.NotApplicableInstance,
    };
}

export function createFromLibraryDefinition(
    label: string,
    libraryDefinition: Library.TLibraryDefinition,
    maybeOther?: string,
): Inspection.AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: libraryDefinition.completionItemKind,
        label,
        powerQueryType: libraryDefinition.asPowerQueryType,
    };
}

export function createFromPrimitiveTypeConstant(
    label: Constant.PrimitiveTypeConstant,
    maybeOther?: string,
): AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Keyword,
        label,
        powerQueryType: TypeUtils.createPrimitiveType(
            label === Constant.PrimitiveTypeConstant.Null,
            TypeUtils.typeKindFromPrimitiveTypeConstantKind(label),
        ),
    };
}

export function maybeCreateFromScopeItem(
    label: string,
    scopeItem: Inspection.TScopeItem,
    powerQueryType: Type.TPowerQueryType,
    maybeOther?: string,
): AutocompleteItem | undefined {
    switch (scopeItem.kind) {
        case Inspection.ScopeItemKind.LetVariable:
        case Inspection.ScopeItemKind.RecordField:
        case Inspection.ScopeItemKind.SectionMember:
            if (scopeItem.maybeValue === undefined) {
                return undefined;
            }

            break;

        case Inspection.ScopeItemKind.Each:
            return undefined;

        case Inspection.ScopeItemKind.Parameter: {
            break;
        }

        case Inspection.ScopeItemKind.Undefined: {
            if (XorNodeUtils.isContextXor(scopeItem.xorNode)) {
                return undefined;
            }

            break;
        }

        default:
            throw Assert.isNever(scopeItem);
    }

    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    return {
        jaroWinklerScore,
        kind: CompletionItemKind.Variable,
        label,
        powerQueryType,
    };
}

export function compareFn(left: AutocompleteItem, right: AutocompleteItem): number {
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
