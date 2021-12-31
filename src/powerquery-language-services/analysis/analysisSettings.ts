// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AutocompleteItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { ILibrary } from "../library/library";
import { InspectionSettings } from "../inspectionSettings";
import { WorkspaceCache } from "../workspaceCache";

export interface AnalysisSettings {
    readonly createInspectionSettingsFn: () => InspectionSettings;
    readonly library: ILibrary;
    readonly maintainWorkspaceCache?: boolean;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => AutocompleteItemProvider;
    readonly maybeCreateLibrarySymbolProviderFn?: (library: ILibrary) => ISymbolProvider;
    readonly maybeCreateLocalDocumentSymbolProviderFn?: (
        library: ILibrary,
        maybeTriedInspection: WorkspaceCache.CacheItem | undefined,
        createInspectionSettingsFn: () => InspectionSettings,
    ) => ISymbolProvider;
    readonly symbolProviderTimeoutInMS?: number;
}
