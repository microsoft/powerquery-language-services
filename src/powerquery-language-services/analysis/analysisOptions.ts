// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ILibrary } from "../library/library";
import { CompletionItemProvider, ISymbolProvider } from "../providers/commonTypes";
import { WorkspaceCache } from "../workspaceCache";

export interface AnalysisOptions {
    readonly createLanguageCompletionItemProviderFn?: () => CompletionItemProvider;
    readonly createLibrarySymbolProviderFn?: (library: ILibrary) => ISymbolProvider;
    readonly createLocalDocumentSymbolProviderFn?: (
        library: ILibrary,
        maybeTriedInspection: WorkspaceCache.TInspectionCacheItem | undefined,
    ) => ISymbolProvider;
    readonly locale?: string;
    readonly maintainWorkspaceCache?: boolean;
}
