// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { InspectionSettings } from "../inspectionSettings";
import { ILibrary } from "../library/library";
import { AutocompleteItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { WorkspaceCache } from "../workspaceCache";

export interface AnalysisSettings<S extends PQP.Parser.IParseState = PQP.Parser.IParseState> {
    readonly createInspectionSettingsFn: () => InspectionSettings<S>;
    readonly maybeCreateLanguageAutocompleteItemProviderFn?: () => AutocompleteItemProvider;
    readonly maybeCreateLibrarySymbolProviderFn?: (library: ILibrary) => ISymbolProvider;
    readonly maybeCreateLocalDocumentSymbolProviderFn?: (
        library: ILibrary,
        maybeTriedInspection: WorkspaceCache.CacheItem | undefined,
    ) => ISymbolProvider;
    readonly maintainWorkspaceCache?: boolean;
}
