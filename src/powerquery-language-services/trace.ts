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
    InspectScope = "Inspection.Scope",
    InspectType = "Inspection.Type",
}

export const enum ValidationTraceConstant {
    Validation = "Validation",
}
