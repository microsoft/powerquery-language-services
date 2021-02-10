// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    CompletionItem,
    CompletionItemKind,
    DocumentSymbol,
    Position,
    Range,
    SymbolKind,
} from "vscode-languageserver-types";
import { AnalysisOptions } from "./analysis/analysisOptions";

export function getLocale(analysisOptions: AnalysisOptions | undefined): string {
    return analysisOptions?.locale ?? DefaultLocale;
}

export function documentSymbolToCompletionItem(
    documentSymbols: ReadonlyArray<DocumentSymbol>,
): ReadonlyArray<CompletionItem> {
    return documentSymbols.map((symbol: DocumentSymbol) => {
        return {
            deprecated: symbol.deprecated,
            detail: symbol.detail,
            label: symbol.name,
            kind: symbolKindToCompletionItemKind(symbol.kind),
        };
    });
}

export function symbolKindToCompletionItemKind(symbolKind: SymbolKind): CompletionItemKind | undefined {
    switch (symbolKind) {
        case SymbolKind.Module:
            return CompletionItemKind.Module;
        case SymbolKind.Field:
            return CompletionItemKind.Field;
        case SymbolKind.Constructor:
            return CompletionItemKind.Constructor;
        case SymbolKind.Enum:
            return CompletionItemKind.Enum;
        case SymbolKind.EnumMember:
            return CompletionItemKind.EnumMember;
        case SymbolKind.Function:
            return CompletionItemKind.Function;
        case SymbolKind.Variable:
            return CompletionItemKind.Variable;
        case SymbolKind.Constant:
            return CompletionItemKind.Constant;
        case SymbolKind.Array:
        case SymbolKind.Boolean:
        case SymbolKind.Number:
        case SymbolKind.Null:
        case SymbolKind.String:
            return CompletionItemKind.Value;
        case SymbolKind.Struct:
            return CompletionItemKind.Struct;
        case SymbolKind.TypeParameter:
            return CompletionItemKind.TypeParameter;
        default:
            return undefined;
    }
}

export function tokenPositionToPosition(tokenPosition: PQP.Language.Token.TokenPosition): Position {
    return {
        line: tokenPosition.lineNumber,
        character: tokenPosition.lineCodeUnit,
    };
}

export function tokenPositionToRange(
    startTokenPosition: PQP.Language.Token.TokenPosition | undefined,
    endTokenPosition: PQP.Language.Token.TokenPosition | undefined,
): Range | undefined {
    if (startTokenPosition && endTokenPosition) {
        return {
            start: tokenPositionToPosition(startTokenPosition),
            end: tokenPositionToPosition(endTokenPosition),
        };
    }

    return undefined;
}

export function tokenRangeToRange(tokenRange: PQP.Language.Token.TokenRange): Range {
    return tokenPositionToRange(tokenRange.positionStart, tokenRange.positionEnd) as Range;
}

const DefaultLocale: string = PQP.Locale.en_US;
