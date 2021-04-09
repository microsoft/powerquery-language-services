// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ILibrary } from "../library/library";
import { AutocompleteItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { WorkspaceCache } from "../workspaceCache";

export interface AnalysisOptions {
    readonly createLanguageAutocompleteItemProviderFn?: () => AutocompleteItemProvider;
    readonly createLibrarySymbolProviderFn?: (library: ILibrary) => ISymbolProvider;
    readonly createLocalDocumentSymbolProviderFn?: (
        library: ILibrary,
        maybeTriedInspection: WorkspaceCache.CacheItem | undefined,
    ) => ISymbolProvider;
    readonly locale?: string;
    readonly maintainWorkspaceCache?: boolean;
}
