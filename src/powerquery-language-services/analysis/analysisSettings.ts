// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AutocompleteItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";
import { Library } from "../library";

export interface AnalysisSettings {
    readonly createInspectionSettingsFn: () => InspectionSettings;
    readonly isWorkspaceCacheAllowed: boolean;
    readonly library: Library.ILibrary;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => AutocompleteItemProvider;
    readonly maybeCreateLibrarySymbolProviderFn?: (library: Library.ILibrary) => ISymbolProvider;
    readonly maybeCreateLocalDocumentSymbolProviderFn?: (
        library: Library.ILibrary,
        promiseMaybeInspected: Promise<Inspection.Inspected | undefined>,
        createInspectionSettingsFn: () => InspectionSettings,
    ) => ISymbolProvider;
    readonly symbolProviderTimeoutInMS?: number;
}
