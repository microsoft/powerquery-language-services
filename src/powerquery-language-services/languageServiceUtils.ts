// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItemKind, SymbolKind } from "vscode-languageserver-types";
import { Assert } from "@microsoft/powerquery-parser";

export function symbolKindToCompletionItemKind(symbolKind: SymbolKind): CompletionItemKind | undefined {
    switch (symbolKind) {
        case SymbolKind.Array:
        case SymbolKind.Boolean:
        case SymbolKind.Number:
        case SymbolKind.Null:
        case SymbolKind.String:
            return CompletionItemKind.Value;

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

        case SymbolKind.Struct:
            return CompletionItemKind.Struct;

        case SymbolKind.TypeParameter:
            return CompletionItemKind.TypeParameter;

        // Either these symbol kinds don't have a valid mapping,
        // or the mapping hasn't been decided yet.
        case SymbolKind.File:
        case SymbolKind.Namespace:
        case SymbolKind.Package:
        case SymbolKind.Class:
        case SymbolKind.Method:
        case SymbolKind.Property:
        case SymbolKind.Interface:
        case SymbolKind.Object:
        case SymbolKind.Key:
        case SymbolKind.Event:
        case SymbolKind.Operator:
            return undefined;

        default:
            throw Assert.isNever(symbolKind);
    }
}
