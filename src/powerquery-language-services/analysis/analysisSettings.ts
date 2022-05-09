// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AutocompleteItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { ILibrary } from "../library/library";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";

export interface AnalysisSettings {
    readonly createInspectionSettingsFn: () => InspectionSettings;
    readonly library: ILibrary;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => AutocompleteItemProvider;
    readonly maybeCreateLibrarySymbolProviderFn?: (library: ILibrary) => ISymbolProvider;
    readonly maybeCreateLocalDocumentSymbolProviderFn?: (
        library: ILibrary,
        promiseMaybeInspected: Promise<Inspection.Inspected | undefined>,
        createInspectionSettingsFn: () => InspectionSettings,
    ) => ISymbolProvider;
    readonly symbolProviderTimeoutInMS?: number;
}
