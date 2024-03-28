// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export enum AutocompleteTraceConstant {
    Autocomplete = "Autocomplete",
    AutocompleteFieldAccess = "FieldAccess",
    AutocompleteKeyword = "Keyword",
    AutocompleteLanguageConstant = "LanguageConstant",
    AutocompletePrimitiveType = "PrimitiveType",
}

export enum InspectionTraceConstant {
    Inspect = "Inspect",
    InspectCurrentInvokeExpression = "Inspection.CurrentInvokeExpression",
    InspectExpectedType = "Inspection.ExpectedType",
    InspectInvokeExpression = "Inspection.InvokeExpression",
    InspectScope = "Inspection.Scope",
    InspectScopeItem = "Inspection.ScopeItem",
    InspectScopeType = "Inspection.ScopeType",
    InspectType = "Inspection.Type",
    InspectionUtils = "InspectionUtils",
}

export enum ProviderTraceConstant {
    LanguageCompletionProvider = "LanguageCompletionProvider",
    LibrarySymbolProvider = "LibrarySymbolProvider",
    LocalDocumentSymbolProvider = "LocalDocumentSymbolProvider",
}

export enum ValidationTraceConstant {
    AnalysisBase = "AnalysisBase",
    Validation = "Validation",
}
