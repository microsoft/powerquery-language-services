// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AutocompleteItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { ILibrary } from "../library/library";
import { Inspection } from "..";
import { InspectionSettings } from "../inspectionSettings";

export interface AnalysisSettings {
    readonly createInspectionSettingsFn: () => InspectionSettings;
    readonly library: ILibrary;
    readonly maintainWorkspaceCache?: boolean;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => AutocompleteItemProvider;
    readonly maybeCreateLibrarySymbolProviderFn?: (library: ILibrary) => ISymbolProvider;
    readonly maybeCreateLocalDocumentSymbolProviderFn?: (
        library: ILibrary,
        promiseMaybeInspection: Promise<Inspection.Inspection | undefined>,
        createInspectionSettingsFn: () => InspectionSettings,
    ) => ISymbolProvider;
    readonly symbolProviderTimeoutInMS?: number;
}
