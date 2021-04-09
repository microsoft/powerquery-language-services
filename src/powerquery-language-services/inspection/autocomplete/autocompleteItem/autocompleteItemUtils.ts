// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItemKind } from "vscode-languageserver-types";
import { Inspection } from "../../..";
import { Library } from "../../../library";
import { calculateJaroWinkler } from "../../jaroWinkler";
import { AutocompleteItem } from "./autocompleteItem";

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

export function createFromLibraryDefinition(
    label: string,
    libraryDefinition: Library.TLibraryDefinition,
    maybeOther?: string,
): Inspection.AutocompleteItem {
    const jaroWinklerScore: number = maybeOther !== undefined ? calculateJaroWinkler(label, maybeOther) : 1;

    let completionItemKind: CompletionItemKind;
    switch (libraryDefinition.kind) {
        case Library.LibraryDefinitionKind.Constant:
            completionItemKind = CompletionItemKind.Value;
            break;

        case Library.LibraryDefinitionKind.Function:
            completionItemKind = CompletionItemKind.Function;
            break;

        case Library.LibraryDefinitionKind.Type:
            completionItemKind = CompletionItemKind.TypeParameter;
            break;

        default:
            throw PQP.Assert.isNever(libraryDefinition);
    }

    return {
        jaroWinklerScore,
        kind: completionItemKind,
        label,
        powerQueryType: libraryDefinition.asType,
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

export function maybeCreateFromScopeItem(
    label: string,
    scopeItem: Inspection.TScopeItem,
    powerQueryType: PQP.Language.Type.PowerQueryType,
    maybeOther?: string,
): AutocompleteItem | undefined {
    switch (scopeItem.kind) {
        case Inspection.ScopeItemKind.LetVariable:
        case Inspection.ScopeItemKind.RecordField:
        case Inspection.ScopeItemKind.SectionMember: {
            if (scopeItem.maybeValue === undefined) {
                return undefined;
            }

            label = scopeItem.isRecursive ? `@${label}` : label;
            break;
        }

        case Inspection.ScopeItemKind.Each:
            return undefined;

        case Inspection.ScopeItemKind.Parameter: {
            break;
        }

        case Inspection.ScopeItemKind.Undefined: {
            if (scopeItem.xorNode.kind !== PQP.Parser.XorNodeKind.Ast) {
                return undefined;
            }

            break;
        }

        default:
            throw PQP.Assert.isNever(scopeItem);
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
    } else {
        if (left.label < right.label) {
            return -1;
        } else if (left.label > right.label) {
            return 1;
        } else {
            return 0;
        }
    }
}
