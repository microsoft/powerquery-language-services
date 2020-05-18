// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LibrarySymbolProvider, SymbolProvider } from "./providers";

export interface AnalysisOptions {
    readonly environmentSymbolProvider?: SymbolProvider;
    readonly librarySymbolProvider?: LibrarySymbolProvider;
    readonly maintainWorkspaceCache?: boolean;
}
