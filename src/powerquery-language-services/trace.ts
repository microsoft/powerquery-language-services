// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const enum AutocompleteTraceConstant {
    Autocomplete = "Autocomplete",
    AutocompleteFieldAccess = "FieldAccess",
    AutocompleteKeyword = "Keyword",
    AutocompleteLanguageConstant = "LanguageConstant",
    AutocompletePrimitiveType = "PrimitiveType",
}

export const enum InspectionTraceConstant {
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

export const enum ProviderTraceConstant {
    LocalDocumentSymbolProvider = "LocalDocumentSymbolProvider",
}

export const enum ValidationTraceConstant {
    AnalysisBase = "AnalysisBase",
    Validation = "Validation",
}
